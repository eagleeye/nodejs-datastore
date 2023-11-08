/*!
 * Copyright 2014 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {promisifyAll} from '@google-cloud/promisify';
import arrify = require('arrify');
import {CallOptions} from 'google-gax';

import {google} from '../protos/protos';

import {Datastore, TransactionOptions} from '.';
import {entity, Entity, Entities} from './entity';
import {
  Query,
  RunQueryCallback,
  RunQueryInfo,
  RunQueryOptions,
  RunQueryResponse,
} from './query';
import {
  CommitCallback,
  CommitResponse,
  DatastoreRequest,
  RequestOptions,
  PrepareEntityObjectResponse,
  CreateReadStreamOptions,
  GetResponse,
  GetCallback,
  RequestCallback,
} from './request';
import {AggregateQuery} from './aggregate';
import {Mutex} from 'async-mutex';

type RunQueryResponseOptional = [
  Entity[] | undefined,
  RunQueryInfo | undefined,
];
interface PassThroughReturnType<T> {
  err?: Error | null;
  resp?: T;
}
interface RequestResolveFunction<T> {
  (callbackData: PassThroughReturnType<T>): void;
}
interface RequestAsPromiseCallback<T> {
  (resolve: RequestResolveFunction<T>): void;
}
interface ResolverType<T> {
  (
    resolve: (
      value: PassThroughReturnType<T> | PromiseLike<PassThroughReturnType<T>>
    ) => void
  ): void;
}

class TransactionState {
  static NOT_TRANSACTION = Symbol('NON_TRANSACTION');
  static NOT_STARTED = Symbol('NOT_STARTED');
  // IN_PROGRESS currently tracks the expired state as well
  static IN_PROGRESS = Symbol('IN_PROGRESS');
}

/**
 * A transaction is a set of Datastore operations on one or more entities. Each
 * transaction is guaranteed to be atomic, which means that transactions are
 * never partially applied. Either all of the operations in the transaction are
 * applied, or none of them are applied.
 *
 * @see {@link https://cloud.google.com/datastore/docs/concepts/transactions| Transactions Reference}
 *
 * @class
 * @extends {Request}
 * @param {Datastore} datastore A Datastore instance.
 * @mixes module:datastore/request
 *
 * @example
 * ```
 * const {Datastore} = require('@google-cloud/datastore');
 * const datastore = new Datastore();
 * const transaction = datastore.transaction();
 * ```
 */
class Transaction extends DatastoreRequest {
  namespace?: string;
  readOnly: boolean;
  request: Function;
  modifiedEntities_: ModifiedEntities;
  skipCommit?: boolean;
  #mutex = new Mutex();
  #state: Symbol = TransactionState.NOT_TRANSACTION;
  constructor(datastore: Datastore, options?: TransactionOptions) {
    super();
    /**
     * @name Transaction#datastore
     * @type {Datastore}
     */
    this.datastore = datastore;

    /**
     * @name Transaction#namespace
     * @type {string}
     */
    this.namespace = datastore.namespace;

    options = options || {};

    this.id = options.id;
    this.readOnly = options.readOnly === true;

    this.request = datastore.request_.bind(datastore);

    // A queue for entity modifications made during the transaction.
    this.modifiedEntities_ = [];

    // Queue the callbacks that process the API responses.
    this.requestCallbacks_ = [];

    // Queue the requests to make when we send the transactional commit.
    this.requests_ = [];
    this.#state = TransactionState.NOT_STARTED;
  }

  /*! Developer Documentation
   *
   * Below, we override two methods that we inherit from DatastoreRequest:
   * `delete` and `save`. This is done because:
   *
   *   A) the documentation needs to be different for a transactional save, and
   *   B) we build up a "modifiedEntities_" array on this object, used to build
   *      the final commit request with.
   */

  #beginWithCallback<T>(
    gaxOptions: CallOptions | undefined,
    promise: Promise<PassThroughReturnType<T>>,
    callback: (err?: Error | null, resp?: T) => void
  ) {
    this.#withBeginTransaction(gaxOptions, promise).then(
      (response: PassThroughReturnType<T>) => {
        callback(response.err, response.resp);
      }
    );
  }

  /**
   * Commit the remote transaction and finalize the current transaction
   * instance.
   *
   * If the commit request fails, we will automatically rollback the
   * transaction.
   *
   * @param {object} [gaxOptions] Request configuration options, outlined here:
   *     https://googleapis.github.io/gax-nodejs/global.html#CallOptions.
   * @param {function} callback The callback function.
   * @param {?error} callback.err An error returned while making this request.
   *   If the commit fails, we automatically try to rollback the transaction
   * (see {module:datastore/transaction#rollback}).
   * @param {object} callback.apiResponse The full API response.
   *
   * @example
   * ```
   * const {Datastore} = require('@google-cloud/datastore');
   * const datastore = new Datastore();
   * const transaction = datastore.transaction();
   *
   * transaction.commit((err, apiResponse) => {
   *   if (err) {
   *     // Transaction could not be committed.
   *   }
   * });
   *
   * //-
   * // If the callback is omitted, we'll return a Promise.
   * //-
   * transaction.commit().then((data) => {
   *   const apiResponse = data[0];
   * });
   * ```
   */
  commit(gaxOptions?: CallOptions): Promise<CommitResponse>;
  commit(callback: CommitCallback): void;
  commit(gaxOptions: CallOptions, callback: CommitCallback): void;
  commit(
    gaxOptionsOrCallback?: CallOptions | CommitCallback,
    cb?: CommitCallback
  ): void | Promise<CommitResponse> {
    const callback =
      typeof gaxOptionsOrCallback === 'function'
        ? gaxOptionsOrCallback
        : typeof cb === 'function'
        ? cb
        : () => {};
    const gaxOptions =
      typeof gaxOptionsOrCallback === 'object' ? gaxOptionsOrCallback : {};
    type commitPromiseType =
      PassThroughReturnType<google.datastore.v1.ICommitResponse>;
    const promise: Promise<commitPromiseType> = new Promise(resolve => {
      this.#runCommit(
        gaxOptions,
        (err?: Error | null, resp?: google.datastore.v1.ICommitResponse) => {
          resolve({err, resp});
        }
      );
    });
    this.#beginWithCallback(gaxOptions, promise, callback);
  }

  async #withBeginTransaction<T>(
    gaxOptions: CallOptions | undefined,
    promise: Promise<PassThroughReturnType<T>>
  ): Promise<PassThroughReturnType<T>> {
    if (this.#state === TransactionState.NOT_STARTED) {
      const release = await this.#mutex.acquire();
      try {
        try {
          if (this.#state === TransactionState.NOT_STARTED) {
            const runResults = await this.runAsync({gaxOptions});
            this.#parseRunSuccess(runResults);
          }
        } finally {
          // TODO: Check that error actually reaches user
          release(); // TODO: Be sure to release the mutex in the error state
        }
      } catch (err: any) {
        return {err};
      }
    }
    return await promise;
  }

  // TODO: Simplify the generics here: remove PassThroughReturnType
  async #someFunction<T>(
    gaxOptions: CallOptions | undefined,
    resolver: (
      resolve: (
        value: PassThroughReturnType<T> | PromiseLike<PassThroughReturnType<T>>
      ) => void
    ) => void
  ): Promise<PassThroughReturnType<T>> {
    if (this.#state === TransactionState.NOT_STARTED) {
      const release = await this.#mutex.acquire();
      try {
        try {
          if (this.#state === TransactionState.NOT_STARTED) {
            const runResults = await this.runAsync({gaxOptions});
            this.#parseRunSuccess(runResults);
          }
        } finally {
          // TODO: Check that error actually reaches user
          release(); // TODO: Be sure to release the mutex in the error state
        }
      } catch (err: any) {
        return {err};
      }
    }
    const promiseResults = await new Promise(resolver);
    return promiseResults;
  }

  /**
   * Create a query for the specified kind. See {module:datastore/query} for all
   * of the available methods.
   *
   * @see {@link https://cloud.google.com/datastore/docs/concepts/queries| Datastore Queries}
   *
   * @see {@link Query}
   *
   * @param {string} [namespace] Namespace.
   * @param {string} kind The kind to query.
   * @returns {Query}
   *
   * @example
   * ```
   * const {Datastore} = require('@google-cloud/datastore');
   * const datastore = new Datastore();
   * const transaction = datastore.transaction();
   *
   * // Run the query inside the transaction.
   * transaction.run((err) => {
   *   if (err) {
   *     // Error handling omitted.
   *   }
   *   const ancestorKey = datastore.key(['ParentCompany', 'Alphabet']);
   *
   *   const query = transaction.createQuery('Company')
   *       .hasAncestor(ancestorKey);
   *
   *   query.run((err, entities) => {
   *     if (err) {
   *       // Error handling omitted.
   *     }
   *
   *     transaction.commit((err) => {
   *       if (!err) {
   *         // Transaction committed successfully.
   *       }
   *     });
   *   });
   * });
   *
   * // Run the query inside the transaction.with namespace
   * transaction.run((err) => {
   *   if (err) {
   *     // Error handling omitted.
   *   }
   *   const ancestorKey = datastore.key(['ParentCompany', 'Alphabet']);
   *
   *   const query = transaction.createQuery('CompanyNamespace', 'Company')
   *       .hasAncestor(ancestorKey);
   *
   *   query.run((err, entities) => {
   *     if (err) {
   *       // Error handling omitted.
   *     }
   *
   *     transaction.commit((err) => {
   *       if (!err) {
   *         // Transaction committed successfully.
   *       }
   *     });
   *   });
   * });
   * ```
   */
  createQuery(kind?: string): Query;
  createQuery(kind?: string[]): Query;
  createQuery(namespace: string, kind: string): Query;
  createQuery(namespace: string, kind: string[]): Query;
  createQuery(
    namespaceOrKind?: string | string[],
    kind?: string | string[]
  ): Query {
    return this.datastore.createQuery.call(
      this,
      namespaceOrKind as string,
      kind as string[]
    );
  }

  /**
   * Create an aggregation query from the query specified. See {module:datastore/query} for all
   * of the available methods.
   *
   */
  createAggregationQuery(query: Query): AggregateQuery {
    return this.datastore.createAggregationQuery.call(this, query);
  }

  /**
   * Delete all entities identified with the specified key(s) in the current
   * transaction.
   *
   * @param {Key|Key[]} key Datastore key object(s).
   *
   * @example
   * ```
   * const {Datastore} = require('@google-cloud/datastore');
   * const datastore = new Datastore();
   * const transaction = datastore.transaction();
   *
   * transaction.run((err) => {
   *   if (err) {
   *     // Error handling omitted.
   *   }
   *
   *   // Delete a single entity.
   *   transaction.delete(datastore.key(['Company', 123]));
   *
   *   // Delete multiple entities at once.
   *   transaction.delete([
   *     datastore.key(['Company', 123]),
   *     datastore.key(['Product', 'Computer'])
   *   ]);
   *
   *   transaction.commit((err) => {
   *     if (!err) {
   *       // Transaction committed successfully.
   *     }
   *   });
   * });
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete(entities?: Entities): any {
    arrify(entities).forEach((ent: Entity) => {
      this.modifiedEntities_.push({
        entity: {
          key: ent,
        },
        method: 'delete',
        args: [ent],
      });
    });
  }

  get(
    keys: entity.Key | entity.Key[],
    options?: CreateReadStreamOptions
  ): Promise<GetResponse>;
  get(keys: entity.Key | entity.Key[], callback: GetCallback): void;
  get(
    keys: entity.Key | entity.Key[],
    options: CreateReadStreamOptions,
    callback: GetCallback
  ): void;
  get(
    keys: entity.Key | entity.Key[],
    optionsOrCallback?: CreateReadStreamOptions | GetCallback,
    cb?: GetCallback
  ): void | Promise<GetResponse> {
    const options =
      typeof optionsOrCallback === 'object' && optionsOrCallback
        ? optionsOrCallback
        : {};
    const callback =
      typeof optionsOrCallback === 'function' ? optionsOrCallback : cb!;
    type promiseType = PassThroughReturnType<GetResponse>;
    const promise: Promise<promiseType> = new Promise(resolve => {
      super.get(keys, options, (err?: Error | null, resp?: GetResponse) => {
        resolve({err, resp});
      });
    });
    this.#beginWithCallback(options.gaxOptions, promise, callback);
  }

  /**
   * Maps to {@link https://cloud.google.com/nodejs/docs/reference/datastore/latest/datastore/transaction#_google_cloud_datastore_Transaction_save_member_1_|Datastore#save}, forcing the method to be `insert`.
   *
   * @param {object|object[]} entities Datastore key object(s).
   * @param {Key} entities.key Datastore key object.
   * @param {string[]} [entities.excludeFromIndexes] Exclude properties from
   *     indexing using a simple JSON path notation. See the examples in
   *     {@link Datastore#save} to see how to target properties at different
   *     levels of nesting within your entity.
   * @param {object} entities.data Data to save with the provided key.
   */
  insert(entities: Entities): void {
    entities = arrify(entities)
      .map(DatastoreRequest.prepareEntityObject_)
      .map((x: PrepareEntityObjectResponse) => {
        x.method = 'insert';
        return x;
      });

    this.save(entities);
  }

  /**
   * Reverse a transaction remotely and finalize the current transaction
   * instance.
   *
   * @param {object} [gaxOptions] Request configuration options, outlined here:
   *     https://googleapis.github.io/gax-nodejs/global.html#CallOptions.
   * @param {function} callback The callback function.
   * @param {?error} callback.err An error returned while making this request.
   * @param {object} callback.apiResponse The full API response.
   *
   * @example
   * ```
   * const {Datastore} = require('@google-cloud/datastore');
   * const datastore = new Datastore();
   * const transaction = datastore.transaction();
   *
   * transaction.run((err) => {
   *   if (err) {
   *     // Error handling omitted.
   *   }
   *
   *   transaction.rollback((err) => {
   *     if (!err) {
   *       // Transaction rolled back successfully.
   *     }
   *   });
   * });
   *
   * //-
   * // If the callback is omitted, we'll return a Promise.
   * //-
   * transaction.rollback().then((data) => {
   *   const apiResponse = data[0];
   * });
   * ```
   */
  rollback(callback: RollbackCallback): void;
  rollback(gaxOptions?: CallOptions): Promise<RollbackResponse>;
  rollback(gaxOptions: CallOptions, callback: RollbackCallback): void;
  rollback(
    gaxOptionsOrCallback?: CallOptions | RollbackCallback,
    cb?: RollbackCallback
  ): void | Promise<RollbackResponse> {
    const gaxOptions =
      typeof gaxOptionsOrCallback === 'object' ? gaxOptionsOrCallback : {};
    const callback =
      typeof gaxOptionsOrCallback === 'function' ? gaxOptionsOrCallback : cb!;

    this.request_(
      {
        client: 'DatastoreClient',
        method: 'rollback',
        gaxOpts: gaxOptions || {},
      },
      (err, resp) => {
        this.skipCommit = true;
        callback(err || null, resp);
      }
    );
  }

  /**
   * Begin a remote transaction. In the callback provided, run your
   * transactional commands.
   *
   * @param {object} [options] Configuration object.
   * @param {object} [options.gaxOptions] Request configuration options, outlined
   *     here: https://googleapis.github.io/gax-nodejs/global.html#CallOptions.
   * @param {boolean} [options.readOnly=false] A read-only transaction cannot
   *     modify entities.
   * @param {string} [options.transactionId] The ID of a previous transaction.
   * @param {function} callback The function to execute within the context of
   *     a transaction.
   * @param {?error} callback.err An error returned while making this request.
   * @param {Transaction} callback.transaction This transaction
   *     instance.
   * @param {object} callback.apiResponse The full API response.
   *
   * @example
   * ```
   * const {Datastore} = require('@google-cloud/datastore');
   * const datastore = new Datastore();
   * const transaction = datastore.transaction();
   *
   * transaction.run((err, transaction) => {
   *   // Perform Datastore transactional operations.
   *   const key = datastore.key(['Company', 123]);
   *
   *   transaction.get(key, (err, entity) => {
   *     entity.name = 'Google';
   *
   *     transaction.save({
   *       key: key,
   *       data: entity
   *     });
   *
   *     transaction.commit((err) => {
   *       if (!err) {
   *         // Data saved successfully.
   *       }
   *     });
   *   });
   * });
   *
   * //-
   * // If the callback is omitted, we'll return a Promise.
   * //-
   * transaction.run().then((data) => {
   *   const transaction = data[0];
   *   const apiResponse = data[1];
   * });
   * ```
   */
  run(options?: RunOptions): Promise<RunResponse>;
  run(callback: RunCallback): void;
  run(options: RunOptions, callback: RunCallback): void;
  run(
    optionsOrCallback?: RunOptions | RunCallback,
    cb?: RunCallback
  ): void | Promise<RunResponse> {
    const options =
      typeof optionsOrCallback === 'object' ? optionsOrCallback : {};
    const callback =
      typeof optionsOrCallback === 'function' ? optionsOrCallback : cb!;
    // TODO: Whenever run is called a second time and a warning is emitted then do nothing.
    // TODO: This means rewriting many tests so that they don't use the same transaction object.
    if (this.#state !== TransactionState.NOT_STARTED) {
      process.emitWarning(
        'run has already been called and should not be called again.'
      );
    }
    this.#mutex.acquire().then(release => {
      this.runAsync(options)
        // TODO: Replace type with google.datastore.v1.IBeginTransactionResponse and address downstream issues
        .then(
          (
            response: PassThroughReturnType<google.datastore.v1.IBeginTransactionResponse>
          ) => {
            // TODO: Probably release the mutex after the id is recorded, but likely doesn't matter since node is single threaded.
            release();
            this.#parseRunAsync(response, callback);
          }
        )
        .catch((err: any) => {
          // TODO: Remove this catch block
          callback(Error('The error should always be caught by then'), this);
        });
    });
  }

  #runCommit(gaxOptions?: CallOptions): Promise<CommitResponse>;
  #runCommit(callback: CommitCallback): void;
  #runCommit(gaxOptions: CallOptions, callback: CommitCallback): void;
  #runCommit(
    gaxOptionsOrCallback?: CallOptions | CommitCallback,
    cb?: CommitCallback
  ): void | Promise<CommitResponse> {
    const callback =
      typeof gaxOptionsOrCallback === 'function'
        ? gaxOptionsOrCallback
        : typeof cb === 'function'
        ? cb
        : () => {};
    const gaxOptions =
      typeof gaxOptionsOrCallback === 'object' ? gaxOptionsOrCallback : {};

    if (this.skipCommit) {
      setImmediate(callback);
      return;
    }

    const keys: Entities = {};

    this.modifiedEntities_
      // Reverse the order of the queue to respect the "last queued request
      // wins" behavior.
      .reverse()
      // Limit the operations we're going to send through to only the most
      // recently queued operations. E.g., if a user tries to save with the
      // same key they just asked to be deleted, the delete request will be
      // ignored, giving preference to the save operation.
      .filter((modifiedEntity: Entity) => {
        const key = modifiedEntity.entity.key;

        if (!entity.isKeyComplete(key)) return true;

        const stringifiedKey = JSON.stringify(modifiedEntity.entity.key);

        if (!keys[stringifiedKey]) {
          keys[stringifiedKey] = true;
          return true;
        }

        return false;
      })
      // Group entities together by method: `save` mutations, then `delete`.
      // Note: `save` mutations being first is required to maintain order when
      // assigning IDs to incomplete keys.
      .sort((a, b) => {
        return a.method < b.method ? 1 : a.method > b.method ? -1 : 0;
      })
      // Group arguments together so that we only make one call to each
      // method. This is important for `DatastoreRequest.save`, especially, as
      // that method handles assigning auto-generated IDs to the original keys
      // passed in. When we eventually execute the `save` method's API
      // callback, having all the keys together is necessary to maintain
      // order.
      .reduce((acc: Entities, entityObject: Entity) => {
        const lastEntityObject = acc[acc.length - 1];
        const sameMethod =
          lastEntityObject && entityObject.method === lastEntityObject.method;

        if (!lastEntityObject || !sameMethod) {
          acc.push(entityObject);
        } else {
          lastEntityObject.args = lastEntityObject.args.concat(
            entityObject.args
          );
        }

        return acc;
      }, [])
      // Call each of the mutational methods (DatastoreRequest[save,delete])
      // to build up a `req` array on this instance. This will also build up a
      // `callbacks` array, that is the same callback that would run if we
      // were using `save` and `delete` outside of a transaction, to process
      // the response from the API.
      .forEach(
        (modifiedEntity: {method: string; args: {reverse: () => void}}) => {
          const method = modifiedEntity.method;
          const args = modifiedEntity.args.reverse();
          Datastore.prototype[method].call(this, args, () => {});
        }
      );

    // Take the `req` array built previously, and merge them into one request to
    // send as the final transactional commit.
    const reqOpts = {
      mutations: this.requests_
        .map((x: {mutations: google.datastore.v1.Mutation}) => x.mutations)
        .reduce(
          (a: {concat: (arg0: Entity) => void}, b: Entity) => a.concat(b),
          []
        ),
    };

    this.request_(
      {
        client: 'DatastoreClient',
        method: 'commit',
        reqOpts,
        gaxOpts: gaxOptions || {},
      },
      (err, resp) => {
        if (err) {
          // Rollback automatically for the user.
          this.rollback(() => {
            // Provide the error & API response from the failed commit to the
            // user. Even a failed rollback should be transparent. RE:
            // https://github.com/GoogleCloudPlatform/google-cloud-node/pull/1369#discussion_r66833976
            callback(err, resp);
          });
          return;
        }

        // The `callbacks` array was built previously. These are the callbacks
        // that handle the API response normally when using the
        // DatastoreRequest.save and .delete methods.
        this.requestCallbacks_.forEach(
          (cb: (arg0: null, arg1: Entity) => void) => {
            cb(null, resp);
          }
        );
        callback(null, resp);
      }
    );
  }

  // TODO: Replace with #parseRunAsync when pack and play error is gone
  #parseRunAsync(
    response: PassThroughReturnType<google.datastore.v1.IBeginTransactionResponse>,
    callback: RunCallback
  ): void {
    const err = response.err;
    const resp = response.resp;
    if (err) {
      callback(err, null, resp);
      return;
    }
    this.#parseRunSuccess(response);
    callback(null, this, resp);
  }

  #parseRunSuccess(response: PassThroughReturnType<any>) {
    const resp = response.resp;
    this.id = resp!.transaction;
    this.#state = TransactionState.IN_PROGRESS;
  }

  // TODO: Replace with #runAsync when pack and play error is gone
  private async runAsync(
    options: RunOptions
  ): Promise<PassThroughReturnType<any>> {
    const reqOpts: RequestOptions = {
      transactionOptions: {},
    };

    if (options.readOnly || this.readOnly) {
      reqOpts.transactionOptions!.readOnly = {};
    }

    if (options.transactionId || this.id) {
      reqOpts.transactionOptions!.readWrite = {
        previousTransaction: options.transactionId || this.id,
      };
    }

    if (options.transactionOptions) {
      reqOpts.transactionOptions = options.transactionOptions;
    }
    const promiseFunction: RequestAsPromiseCallback<any> = (
      resolve: RequestResolveFunction<any>
    ) => {
      this.request_(
        {
          client: 'DatastoreClient',
          method: 'beginTransaction',
          reqOpts,
          gaxOpts: options.gaxOptions,
        },
        // In original functionality sometimes a response is provided when an error is also provided
        // reject only allows us to pass back an error so use resolve for both error and non-error cases.
        (err, resp) => {
          resolve({
            err,
            resp,
          });
        }
      );
    };
    return new Promise(promiseFunction);
  }

  runAggregationQuery(
    query: AggregateQuery,
    options?: RunQueryOptions
  ): Promise<RunQueryResponse>;
  runAggregationQuery(
    query: AggregateQuery,
    options: RunQueryOptions,
    callback: RequestCallback
  ): void;
  runAggregationQuery(query: AggregateQuery, callback: RequestCallback): void;
  runAggregationQuery(
    query: AggregateQuery,
    optionsOrCallback?: RunQueryOptions | RequestCallback,
    cb?: RequestCallback
  ): void | Promise<RunQueryResponse> {
    const options =
      typeof optionsOrCallback === 'object' && optionsOrCallback
        ? optionsOrCallback
        : {};
    const callback =
      typeof optionsOrCallback === 'function' ? optionsOrCallback : cb!;
    type promiseType = PassThroughReturnType<PassThroughReturnType<any>>;
    const resolver: ResolverType<any> = resolve => {
      super.runAggregationQuery(
        query,
        options,
        (err?: Error | null, resp?: any) => {
          resolve({err, resp});
        }
      );
    };
    this.#someFunction(options.gaxOptions, resolver).then(
      (response: promiseType) => {
        const error = response.err ? response.err : null;
        callback(error, response.resp);
      }
    );
  }

  /*
  runQuery(query: Query, options?: RunQueryOptions): Promise<RunQueryResponse>;
  runQuery(
    query: Query,
    options: RunQueryOptions,
    callback: RunQueryCallback
  ): void;
  runQuery(query: Query, callback: RunQueryCallback): void;
  runQuery(
    query: Query,
    optionsOrCallback?: RunQueryOptions | RunQueryCallback,
    cb?: RunQueryCallback
  ): void | Promise<RunQueryResponse> {
    const options =
      typeof optionsOrCallback === 'object' && optionsOrCallback
        ? optionsOrCallback
        : {};
    const callback =
      typeof optionsOrCallback === 'function' ? optionsOrCallback : cb!;
    type promiseType = PassThroughReturnType<RunQueryResponseOptional>;
    const promise: Promise<promiseType> = new Promise(resolve => {
      super.runQuery(
        query,
        options,
        (err: Error | null, entities?: Entity[], info?: RunQueryInfo) => {
          resolve({err, resp: [entities, info]});
        }
      );
    });
    this.#withBeginTransaction(options.gaxOptions, promise).then(
      (response: promiseType) => {
        const error = response.err ? response.err : null;
        callback(error, response.resp);
      }
    );
  }
  */

  /**
   * Insert or update the specified object(s) in the current transaction. If a
   * key is incomplete, its associated object is inserted and the original Key
   * object is updated to contain the generated ID.
   *
   * This method will determine the correct Datastore method to execute
   * (`upsert`, `insert`, or `update`) by using the key(s) provided. For
   * example, if you provide an incomplete key (one without an ID), the request
   * will create a new entity and have its ID automatically assigned. If you
   * provide a complete key, the entity will be updated with the data specified.
   *
   * By default, all properties are indexed. To prevent a property from being
   * included in *all* indexes, you must supply an `excludeFromIndexes` array.
   * See below for an example.
   *
   * @param {object|object[]} entities Datastore key object(s).
   * @param {Key} entities.key Datastore key object.
   * @param {string[]} [entities.excludeFromIndexes] Exclude properties from
   *     indexing using a simple JSON path notation. See the example below to
   * see how to target properties at different levels of nesting within your
   *     entity.
   * @param {object} entities.data Data to save with the provided key.
   *
   * @example
   * ```
   * <caption>Save a single entity.</caption>
   * const {Datastore} = require('@google-cloud/datastore');
   * const datastore = new Datastore();
   * const transaction = datastore.transaction();
   *
   * // Notice that we are providing an incomplete key. After the transaction is
   * // committed, the Key object held by the `key` variable will be populated
   * // with a path containing its generated ID.
   * //-
   * const key = datastore.key('Company');
   *
   * transaction.run((err) => {
   *   if (err) {
   *     // Error handling omitted.
   *   }
   *
   *   transaction.save({
   *     key: key,
   *     data: {
   *       rating: '10'
   *     }
   *   });
   *
   *   transaction.commit((err) => {
   *     if (!err) {
   *       // Data saved successfully.
   *     }
   *   });
   * });
   *
   * ```
   * @example
   * ```
   * const {Datastore} = require('@google-cloud/datastore');
   * const datastore = new Datastore();
   * const transaction = datastore.transaction();
   *
   * // Use an array, `excludeFromIndexes`, to exclude properties from indexing.
   * // This will allow storing string values larger than 1500 bytes.
   *
   * transaction.run((err) => {
   *   if (err) {
   *     // Error handling omitted.
   *   }
   *
   *   transaction.save({
   *     key: key,
   *     excludeFromIndexes: [
   *       'description',
   *       'embeddedEntity.description',
   *       'arrayValue[].description'
   *     ],
   *     data: {
   *       description: 'Long string (...)',
   *       embeddedEntity: {
   *         description: 'Long string (...)'
   *       },
   *       arrayValue: [
   *         {
   *           description: 'Long string (...)'
   *         }
   *       ]
   *     }
   *   });
   *
   *   transaction.commit((err) => {
   *     if (!err) {
   *       // Data saved successfully.
   *     }
   *   });
   * });
   *
   * ```
   * @example
   * ```
   * <caption>Save multiple entities at once.</caption>
   * const {Datastore} = require('@google-cloud/datastore');
   * const datastore = new Datastore();
   * const transaction = datastore.transaction();
   * const companyKey = datastore.key(['Company', 123]);
   * const productKey = datastore.key(['Product', 'Computer']);
   *
   * transaction.run((err) => {
   *   if (err) {
   *     // Error handling omitted.
   *   }
   *
   *   transaction.save([
   *     {
   *       key: companyKey,
   *       data: {
   *         HQ: 'Dallas, TX'
   *       }
   *     },
   *     {
   *       key: productKey,
   *       data: {
   *         vendor: 'Dell'
   *       }
   *     }
   *   ]);
   *
   *   transaction.commit((err) => {
   *     if (!err) {
   *       // Data saved successfully.
   *     }
   *   });
   * });
   * ```
   */
  save(entities: Entities): void {
    arrify(entities).forEach((ent: Entity) => {
      this.modifiedEntities_.push({
        entity: {
          key: ent.key,
        },
        method: 'save',
        args: [ent],
      });
    });
  }

  /**
   * Maps to {@link https://cloud.google.com/nodejs/docs/reference/datastore/latest/datastore/transaction#_google_cloud_datastore_Transaction_save_member_1_|Datastore#save}, forcing the method to be `update`.
   *
   * @param {object|object[]} entities Datastore key object(s).
   * @param {Key} entities.key Datastore key object.
   * @param {string[]} [entities.excludeFromIndexes] Exclude properties from
   *     indexing using a simple JSON path notation. See the examples in
   *     {@link Datastore#save} to see how to target properties at different
   *     levels of nesting within your entity.
   * @param {object} entities.data Data to save with the provided key.
   */
  update(entities: Entities): void {
    entities = arrify(entities)
      .map(DatastoreRequest.prepareEntityObject_)
      .map((x: PrepareEntityObjectResponse) => {
        x.method = 'update';
        return x;
      });

    this.save(entities);
  }

  /**
   * Maps to {@link https://cloud.google.com/nodejs/docs/reference/datastore/latest/datastore/transaction#_google_cloud_datastore_Transaction_save_member_1_|Datastore#save}, forcing the method to be `upsert`.
   *
   * @param {object|object[]} entities Datastore key object(s).
   * @param {Key} entities.key Datastore key object.
   * @param {string[]} [entities.excludeFromIndexes] Exclude properties from
   *     indexing using a simple JSON path notation. See the examples in
   *     {@link Datastore#save} to see how to target properties at different
   *     levels of nesting within your entity.
   * @param {object} entities.data Data to save with the provided key.
   */
  upsert(entities: Entities): void {
    entities = arrify(entities)
      .map(DatastoreRequest.prepareEntityObject_)
      .map((x: PrepareEntityObjectResponse) => {
        x.method = 'upsert';
        return x;
      });

    this.save(entities);
  }
}

export type ModifiedEntities = Array<{
  entity: {key: Entity};
  method: string;
  args: Entity[];
}>;
export type RunResponse = [
  Transaction,
  google.datastore.v1.IBeginTransactionResponse,
];
export interface RunCallback {
  (
    error: Error | null,
    transaction: Transaction | null,
    response?: google.datastore.v1.IBeginTransactionResponse
  ): void;
}
export interface RollbackCallback {
  (error: Error | null, response?: google.datastore.v1.IRollbackResponse): void;
}
export type RollbackResponse = [google.datastore.v1.IRollbackResponse];
export interface RunOptions {
  readOnly?: boolean;
  transactionId?: string;
  transactionOptions?: TransactionOptions;
  gaxOptions?: CallOptions;
}
/*! Developer Documentation
 *
 * All async methods (except for streams) will return a Promise in the event
 * that a callback is omitted.
 */
promisifyAll(Transaction, {
  exclude: [
    'createAggregationQuery',
    '#commitAsync',
    'createQuery',
    'delete',
    'insert',
    'parseRunAsync',
    'parseTransactionResponse',
    'runAsync',
    'save',
    '#someFunction',
    'update',
    'upsert',
  ],
});

/**
 * Reference to the {@link Transaction} class.
 * @name module:@google-cloud/datastore.Transaction
 * @see Transaction
 */
export {Transaction};
