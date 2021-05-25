// Copyright 2021 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// ** This file is automatically generated by gapic-generator-typescript. **
// ** https://github.com/googleapis/gapic-generator-typescript **
// ** All changes to this file may be overwritten. **

/* global window */
import * as gax from 'google-gax';
import {Callback, CallOptions, Descriptors, ClientOptions} from 'google-gax';
import * as path from 'path';

import * as protos from '../../protos/protos';
/**
 * Client JSON configuration object, loaded from
 * `src/v1/datastore_client_config.json`.
 * This file defines retry strategy and timeouts for all API methods in this library.
 */
import * as gapicConfig from './datastore_client_config.json';

const version = require('../../../package.json').version;

/**
 *  Each RPC normalizes the partition IDs of the keys in its input entities,
 *  and always returns entities with keys with normalized partition IDs.
 *  This applies to all keys and entities, including those in values, except keys
 *  with both an empty path and an empty or unset partition ID. Normalization of
 *  input keys sets the project ID (if not already set) to the project ID from
 *  the request.
 *
 * @class
 * @memberof v1
 */
export class DatastoreClient {
  private _terminated = false;
  private _opts: ClientOptions;
  private _gaxModule: typeof gax | typeof gax.fallback;
  private _gaxGrpc: gax.GrpcClient | gax.fallback.GrpcClient;
  private _protos: {};
  private _defaults: {[method: string]: gax.CallSettings};
  auth: gax.GoogleAuth;
  descriptors: Descriptors = {
    page: {},
    stream: {},
    longrunning: {},
    batching: {},
  };
  innerApiCalls: {[name: string]: Function};
  datastoreStub?: Promise<{[name: string]: Function}>;

  /**
   * Construct an instance of DatastoreClient.
   *
   * @param {object} [options] - The configuration object.
   * The options accepted by the constructor are described in detail
   * in [this document](https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#creating-the-client-instance).
   * The common options are:
   * @param {object} [options.credentials] - Credentials object.
   * @param {string} [options.credentials.client_email]
   * @param {string} [options.credentials.private_key]
   * @param {string} [options.email] - Account email address. Required when
   *     using a .pem or .p12 keyFilename.
   * @param {string} [options.keyFilename] - Full path to the a .json, .pem, or
   *     .p12 key downloaded from the Google Developers Console. If you provide
   *     a path to a JSON file, the projectId option below is not necessary.
   *     NOTE: .pem and .p12 require you to specify options.email as well.
   * @param {number} [options.port] - The port on which to connect to
   *     the remote host.
   * @param {string} [options.projectId] - The project ID from the Google
   *     Developer's Console, e.g. 'grape-spaceship-123'. We will also check
   *     the environment variable GCLOUD_PROJECT for your project ID. If your
   *     app is running in an environment which supports
   *     {@link https://developers.google.com/identity/protocols/application-default-credentials Application Default Credentials},
   *     your project ID will be detected automatically.
   * @param {string} [options.apiEndpoint] - The domain name of the
   *     API remote host.
   * @param {gax.ClientConfig} [options.clientConfig] - Client configuration override.
   *     Follows the structure of {@link gapicConfig}.
   * @param {boolean} [options.fallback] - Use HTTP fallback mode.
   *     In fallback mode, a special browser-compatible transport implementation is used
   *     instead of gRPC transport. In browser context (if the `window` object is defined)
   *     the fallback mode is enabled automatically; set `options.fallback` to `false`
   *     if you need to override this behavior.
   */
  constructor(opts?: ClientOptions) {
    // Ensure that options include all the required fields.
    const staticMembers = this.constructor as typeof DatastoreClient;
    const servicePath =
      opts?.servicePath || opts?.apiEndpoint || staticMembers.servicePath;
    const port = opts?.port || staticMembers.port;
    const clientConfig = opts?.clientConfig ?? {};
    const fallback =
      opts?.fallback ??
      (typeof window !== 'undefined' && typeof window?.fetch === 'function');
    opts = Object.assign({servicePath, port, clientConfig, fallback}, opts);

    // If scopes are unset in options and we're connecting to a non-default endpoint, set scopes just in case.
    if (servicePath !== staticMembers.servicePath && !('scopes' in opts)) {
      opts['scopes'] = staticMembers.scopes;
    }

    // Choose either gRPC or proto-over-HTTP implementation of google-gax.
    this._gaxModule = opts.fallback ? gax.fallback : gax;

    // Create a `gaxGrpc` object, with any grpc-specific options sent to the client.
    this._gaxGrpc = new this._gaxModule.GrpcClient(opts);

    // Save options to use in initialize() method.
    this._opts = opts;

    // Save the auth object to the client, for use by other methods.
    this.auth = this._gaxGrpc.auth as gax.GoogleAuth;

    // Set the default scopes in auth client if needed.
    if (servicePath === staticMembers.servicePath) {
      this.auth.defaultScopes = staticMembers.scopes;
    }

    // Determine the client header string.
    const clientHeader = [`gax/${this._gaxModule.version}`, `gapic/${version}`];
    if (typeof process !== 'undefined' && 'versions' in process) {
      clientHeader.push(`gl-node/${process.versions.node}`);
    } else {
      clientHeader.push(`gl-web/${this._gaxModule.version}`);
    }
    if (!opts.fallback) {
      clientHeader.push(`grpc/${this._gaxGrpc.grpcVersion}`);
    }
    if (opts.libName && opts.libVersion) {
      clientHeader.push(`${opts.libName}/${opts.libVersion}`);
    }
    // Load the applicable protos.
    // For Node.js, pass the path to JSON proto file.
    // For browsers, pass the JSON content.

    const nodejsProtoPath = path.join(
      __dirname,
      '..',
      '..',
      'protos',
      'protos.json'
    );
    this._protos = this._gaxGrpc.loadProto(
      opts.fallback
        ? // eslint-disable-next-line @typescript-eslint/no-var-requires
          require('../../protos/protos.json')
        : nodejsProtoPath
    );

    // Put together the default options sent with requests.
    this._defaults = this._gaxGrpc.constructSettings(
      'google.datastore.v1.Datastore',
      gapicConfig as gax.ClientConfig,
      opts.clientConfig || {},
      {'x-goog-api-client': clientHeader.join(' ')}
    );

    // Set up a dictionary of "inner API calls"; the core implementation
    // of calling the API is handled in `google-gax`, with this code
    // merely providing the destination and request information.
    this.innerApiCalls = {};
  }

  /**
   * Initialize the client.
   * Performs asynchronous operations (such as authentication) and prepares the client.
   * This function will be called automatically when any class method is called for the
   * first time, but if you need to initialize it before calling an actual method,
   * feel free to call initialize() directly.
   *
   * You can await on this method if you want to make sure the client is initialized.
   *
   * @returns {Promise} A promise that resolves to an authenticated service stub.
   */
  initialize() {
    // If the client stub promise is already initialized, return immediately.
    if (this.datastoreStub) {
      return this.datastoreStub;
    }

    // Put together the "service stub" for
    // google.datastore.v1.Datastore.
    this.datastoreStub = this._gaxGrpc.createStub(
      this._opts.fallback
        ? (this._protos as protobuf.Root).lookupService(
            'google.datastore.v1.Datastore'
          )
        : // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (this._protos as any).google.datastore.v1.Datastore,
      this._opts
    ) as Promise<{[method: string]: Function}>;

    // Iterate over each of the methods that the service provides
    // and create an API call method for each.
    const datastoreStubMethods = [
      'lookup',
      'runQuery',
      'beginTransaction',
      'commit',
      'rollback',
      'allocateIds',
      'reserveIds',
    ];
    for (const methodName of datastoreStubMethods) {
      const callPromise = this.datastoreStub.then(
        stub =>
          (...args: Array<{}>) => {
            if (this._terminated) {
              return Promise.reject('The client has already been closed.');
            }
            const func = stub[methodName];
            return func.apply(stub, args);
          },
        (err: Error | null | undefined) => () => {
          throw err;
        }
      );

      const descriptor = undefined;
      const apiCall = this._gaxModule.createApiCall(
        callPromise,
        this._defaults[methodName],
        descriptor
      );

      this.innerApiCalls[methodName] = apiCall;
    }

    return this.datastoreStub;
  }

  /**
   * The DNS address for this API service.
   * @returns {string} The DNS address for this service.
   */
  static get servicePath() {
    return 'datastore.googleapis.com';
  }

  /**
   * The DNS address for this API service - same as servicePath(),
   * exists for compatibility reasons.
   * @returns {string} The DNS address for this service.
   */
  static get apiEndpoint() {
    return 'datastore.googleapis.com';
  }

  /**
   * The port for this API service.
   * @returns {number} The default port for this service.
   */
  static get port() {
    return 443;
  }

  /**
   * The scopes needed to make gRPC calls for every method defined
   * in this service.
   * @returns {string[]} List of default scopes.
   */
  static get scopes() {
    return [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/datastore',
    ];
  }

  getProjectId(): Promise<string>;
  getProjectId(callback: Callback<string, undefined, undefined>): void;
  /**
   * Return the project ID used by this class.
   * @returns {Promise} A promise that resolves to string containing the project ID.
   */
  getProjectId(
    callback?: Callback<string, undefined, undefined>
  ): Promise<string> | void {
    if (callback) {
      this.auth.getProjectId(callback);
      return;
    }
    return this.auth.getProjectId();
  }

  // -------------------
  // -- Service calls --
  // -------------------
  lookup(
    request: protos.google.datastore.v1.ILookupRequest,
    options?: CallOptions
  ): Promise<
    [
      protos.google.datastore.v1.ILookupResponse,
      protos.google.datastore.v1.ILookupRequest | undefined,
      {} | undefined
    ]
  >;
  lookup(
    request: protos.google.datastore.v1.ILookupRequest,
    options: CallOptions,
    callback: Callback<
      protos.google.datastore.v1.ILookupResponse,
      protos.google.datastore.v1.ILookupRequest | null | undefined,
      {} | null | undefined
    >
  ): void;
  lookup(
    request: protos.google.datastore.v1.ILookupRequest,
    callback: Callback<
      protos.google.datastore.v1.ILookupResponse,
      protos.google.datastore.v1.ILookupRequest | null | undefined,
      {} | null | undefined
    >
  ): void;
  /**
   * Looks up entities by key.
   *
   * @param {Object} request
   *   The request object that will be sent.
   * @param {string} request.projectId
   *   Required. The ID of the project against which to make the request.
   * @param {google.datastore.v1.ReadOptions} request.readOptions
   *   The options for this lookup request.
   * @param {number[]} request.keys
   *   Required. Keys of entities to look up.
   * @param {object} [options]
   *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
   * @returns {Promise} - The promise which resolves to an array.
   *   The first element of the array is an object representing [LookupResponse]{@link google.datastore.v1.LookupResponse}.
   *   Please see the
   *   [documentation](https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods)
   *   for more details and examples.
   * @example
   * const [response] = await client.lookup(request);
   */
  lookup(
    request: protos.google.datastore.v1.ILookupRequest,
    optionsOrCallback?:
      | CallOptions
      | Callback<
          protos.google.datastore.v1.ILookupResponse,
          protos.google.datastore.v1.ILookupRequest | null | undefined,
          {} | null | undefined
        >,
    callback?: Callback<
      protos.google.datastore.v1.ILookupResponse,
      protos.google.datastore.v1.ILookupRequest | null | undefined,
      {} | null | undefined
    >
  ): Promise<
    [
      protos.google.datastore.v1.ILookupResponse,
      protos.google.datastore.v1.ILookupRequest | undefined,
      {} | undefined
    ]
  > | void {
    request = request || {};
    let options: CallOptions;
    if (typeof optionsOrCallback === 'function' && callback === undefined) {
      callback = optionsOrCallback;
      options = {};
    } else {
      options = optionsOrCallback as CallOptions;
    }
    options = options || {};
    options.otherArgs = options.otherArgs || {};
    options.otherArgs.headers = options.otherArgs.headers || {};
    options.otherArgs.headers['x-goog-request-params'] =
      gax.routingHeader.fromParams({
        project_id: request.projectId || '',
      });
    this.initialize();
    return this.innerApiCalls.lookup(request, options, callback);
  }
  runQuery(
    request: protos.google.datastore.v1.IRunQueryRequest,
    options?: CallOptions
  ): Promise<
    [
      protos.google.datastore.v1.IRunQueryResponse,
      protos.google.datastore.v1.IRunQueryRequest | undefined,
      {} | undefined
    ]
  >;
  runQuery(
    request: protos.google.datastore.v1.IRunQueryRequest,
    options: CallOptions,
    callback: Callback<
      protos.google.datastore.v1.IRunQueryResponse,
      protos.google.datastore.v1.IRunQueryRequest | null | undefined,
      {} | null | undefined
    >
  ): void;
  runQuery(
    request: protos.google.datastore.v1.IRunQueryRequest,
    callback: Callback<
      protos.google.datastore.v1.IRunQueryResponse,
      protos.google.datastore.v1.IRunQueryRequest | null | undefined,
      {} | null | undefined
    >
  ): void;
  /**
   * Queries for entities.
   *
   * @param {Object} request
   *   The request object that will be sent.
   * @param {string} request.projectId
   *   Required. The ID of the project against which to make the request.
   * @param {google.datastore.v1.PartitionId} request.partitionId
   *   Entities are partitioned into subsets, identified by a partition ID.
   *   Queries are scoped to a single partition.
   *   This partition ID is normalized with the standard default context
   *   partition ID.
   * @param {google.datastore.v1.ReadOptions} request.readOptions
   *   The options for this query.
   * @param {google.datastore.v1.Query} request.query
   *   The query to run.
   * @param {google.datastore.v1.GqlQuery} request.gqlQuery
   *   The GQL query to run.
   * @param {object} [options]
   *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
   * @returns {Promise} - The promise which resolves to an array.
   *   The first element of the array is an object representing [RunQueryResponse]{@link google.datastore.v1.RunQueryResponse}.
   *   Please see the
   *   [documentation](https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods)
   *   for more details and examples.
   * @example
   * const [response] = await client.runQuery(request);
   */
  runQuery(
    request: protos.google.datastore.v1.IRunQueryRequest,
    optionsOrCallback?:
      | CallOptions
      | Callback<
          protos.google.datastore.v1.IRunQueryResponse,
          protos.google.datastore.v1.IRunQueryRequest | null | undefined,
          {} | null | undefined
        >,
    callback?: Callback<
      protos.google.datastore.v1.IRunQueryResponse,
      protos.google.datastore.v1.IRunQueryRequest | null | undefined,
      {} | null | undefined
    >
  ): Promise<
    [
      protos.google.datastore.v1.IRunQueryResponse,
      protos.google.datastore.v1.IRunQueryRequest | undefined,
      {} | undefined
    ]
  > | void {
    request = request || {};
    let options: CallOptions;
    if (typeof optionsOrCallback === 'function' && callback === undefined) {
      callback = optionsOrCallback;
      options = {};
    } else {
      options = optionsOrCallback as CallOptions;
    }
    options = options || {};
    options.otherArgs = options.otherArgs || {};
    options.otherArgs.headers = options.otherArgs.headers || {};
    options.otherArgs.headers['x-goog-request-params'] =
      gax.routingHeader.fromParams({
        project_id: request.projectId || '',
      });
    this.initialize();
    return this.innerApiCalls.runQuery(request, options, callback);
  }
  beginTransaction(
    request: protos.google.datastore.v1.IBeginTransactionRequest,
    options?: CallOptions
  ): Promise<
    [
      protos.google.datastore.v1.IBeginTransactionResponse,
      protos.google.datastore.v1.IBeginTransactionRequest | undefined,
      {} | undefined
    ]
  >;
  beginTransaction(
    request: protos.google.datastore.v1.IBeginTransactionRequest,
    options: CallOptions,
    callback: Callback<
      protos.google.datastore.v1.IBeginTransactionResponse,
      protos.google.datastore.v1.IBeginTransactionRequest | null | undefined,
      {} | null | undefined
    >
  ): void;
  beginTransaction(
    request: protos.google.datastore.v1.IBeginTransactionRequest,
    callback: Callback<
      protos.google.datastore.v1.IBeginTransactionResponse,
      protos.google.datastore.v1.IBeginTransactionRequest | null | undefined,
      {} | null | undefined
    >
  ): void;
  /**
   * Begins a new transaction.
   *
   * @param {Object} request
   *   The request object that will be sent.
   * @param {string} request.projectId
   *   Required. The ID of the project against which to make the request.
   * @param {google.datastore.v1.TransactionOptions} request.transactionOptions
   *   Options for a new transaction.
   * @param {object} [options]
   *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
   * @returns {Promise} - The promise which resolves to an array.
   *   The first element of the array is an object representing [BeginTransactionResponse]{@link google.datastore.v1.BeginTransactionResponse}.
   *   Please see the
   *   [documentation](https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods)
   *   for more details and examples.
   * @example
   * const [response] = await client.beginTransaction(request);
   */
  beginTransaction(
    request: protos.google.datastore.v1.IBeginTransactionRequest,
    optionsOrCallback?:
      | CallOptions
      | Callback<
          protos.google.datastore.v1.IBeginTransactionResponse,
          | protos.google.datastore.v1.IBeginTransactionRequest
          | null
          | undefined,
          {} | null | undefined
        >,
    callback?: Callback<
      protos.google.datastore.v1.IBeginTransactionResponse,
      protos.google.datastore.v1.IBeginTransactionRequest | null | undefined,
      {} | null | undefined
    >
  ): Promise<
    [
      protos.google.datastore.v1.IBeginTransactionResponse,
      protos.google.datastore.v1.IBeginTransactionRequest | undefined,
      {} | undefined
    ]
  > | void {
    request = request || {};
    let options: CallOptions;
    if (typeof optionsOrCallback === 'function' && callback === undefined) {
      callback = optionsOrCallback;
      options = {};
    } else {
      options = optionsOrCallback as CallOptions;
    }
    options = options || {};
    options.otherArgs = options.otherArgs || {};
    options.otherArgs.headers = options.otherArgs.headers || {};
    options.otherArgs.headers['x-goog-request-params'] =
      gax.routingHeader.fromParams({
        project_id: request.projectId || '',
      });
    this.initialize();
    return this.innerApiCalls.beginTransaction(request, options, callback);
  }
  commit(
    request: protos.google.datastore.v1.ICommitRequest,
    options?: CallOptions
  ): Promise<
    [
      protos.google.datastore.v1.ICommitResponse,
      protos.google.datastore.v1.ICommitRequest | undefined,
      {} | undefined
    ]
  >;
  commit(
    request: protos.google.datastore.v1.ICommitRequest,
    options: CallOptions,
    callback: Callback<
      protos.google.datastore.v1.ICommitResponse,
      protos.google.datastore.v1.ICommitRequest | null | undefined,
      {} | null | undefined
    >
  ): void;
  commit(
    request: protos.google.datastore.v1.ICommitRequest,
    callback: Callback<
      protos.google.datastore.v1.ICommitResponse,
      protos.google.datastore.v1.ICommitRequest | null | undefined,
      {} | null | undefined
    >
  ): void;
  /**
   * Commits a transaction, optionally creating, deleting or modifying some
   * entities.
   *
   * @param {Object} request
   *   The request object that will be sent.
   * @param {string} request.projectId
   *   Required. The ID of the project against which to make the request.
   * @param {google.datastore.v1.CommitRequest.Mode} request.mode
   *   The type of commit to perform. Defaults to `TRANSACTIONAL`.
   * @param {Buffer} request.transaction
   *   The identifier of the transaction associated with the commit. A
   *   transaction identifier is returned by a call to
   *   {@link google.datastore.v1.Datastore.BeginTransaction|Datastore.BeginTransaction}.
   * @param {number[]} request.mutations
   *   The mutations to perform.
   *
   *   When mode is `TRANSACTIONAL`, mutations affecting a single entity are
   *   applied in order. The following sequences of mutations affecting a single
   *   entity are not permitted in a single `Commit` request:
   *
   *   - `insert` followed by `insert`
   *   - `update` followed by `insert`
   *   - `upsert` followed by `insert`
   *   - `delete` followed by `update`
   *
   *   When mode is `NON_TRANSACTIONAL`, no two mutations may affect a single
   *   entity.
   * @param {object} [options]
   *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
   * @returns {Promise} - The promise which resolves to an array.
   *   The first element of the array is an object representing [CommitResponse]{@link google.datastore.v1.CommitResponse}.
   *   Please see the
   *   [documentation](https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods)
   *   for more details and examples.
   * @example
   * const [response] = await client.commit(request);
   */
  commit(
    request: protos.google.datastore.v1.ICommitRequest,
    optionsOrCallback?:
      | CallOptions
      | Callback<
          protos.google.datastore.v1.ICommitResponse,
          protos.google.datastore.v1.ICommitRequest | null | undefined,
          {} | null | undefined
        >,
    callback?: Callback<
      protos.google.datastore.v1.ICommitResponse,
      protos.google.datastore.v1.ICommitRequest | null | undefined,
      {} | null | undefined
    >
  ): Promise<
    [
      protos.google.datastore.v1.ICommitResponse,
      protos.google.datastore.v1.ICommitRequest | undefined,
      {} | undefined
    ]
  > | void {
    request = request || {};
    let options: CallOptions;
    if (typeof optionsOrCallback === 'function' && callback === undefined) {
      callback = optionsOrCallback;
      options = {};
    } else {
      options = optionsOrCallback as CallOptions;
    }
    options = options || {};
    options.otherArgs = options.otherArgs || {};
    options.otherArgs.headers = options.otherArgs.headers || {};
    options.otherArgs.headers['x-goog-request-params'] =
      gax.routingHeader.fromParams({
        project_id: request.projectId || '',
      });
    this.initialize();
    return this.innerApiCalls.commit(request, options, callback);
  }
  rollback(
    request: protos.google.datastore.v1.IRollbackRequest,
    options?: CallOptions
  ): Promise<
    [
      protos.google.datastore.v1.IRollbackResponse,
      protos.google.datastore.v1.IRollbackRequest | undefined,
      {} | undefined
    ]
  >;
  rollback(
    request: protos.google.datastore.v1.IRollbackRequest,
    options: CallOptions,
    callback: Callback<
      protos.google.datastore.v1.IRollbackResponse,
      protos.google.datastore.v1.IRollbackRequest | null | undefined,
      {} | null | undefined
    >
  ): void;
  rollback(
    request: protos.google.datastore.v1.IRollbackRequest,
    callback: Callback<
      protos.google.datastore.v1.IRollbackResponse,
      protos.google.datastore.v1.IRollbackRequest | null | undefined,
      {} | null | undefined
    >
  ): void;
  /**
   * Rolls back a transaction.
   *
   * @param {Object} request
   *   The request object that will be sent.
   * @param {string} request.projectId
   *   Required. The ID of the project against which to make the request.
   * @param {Buffer} request.transaction
   *   Required. The transaction identifier, returned by a call to
   *   {@link google.datastore.v1.Datastore.BeginTransaction|Datastore.BeginTransaction}.
   * @param {object} [options]
   *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
   * @returns {Promise} - The promise which resolves to an array.
   *   The first element of the array is an object representing [RollbackResponse]{@link google.datastore.v1.RollbackResponse}.
   *   Please see the
   *   [documentation](https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods)
   *   for more details and examples.
   * @example
   * const [response] = await client.rollback(request);
   */
  rollback(
    request: protos.google.datastore.v1.IRollbackRequest,
    optionsOrCallback?:
      | CallOptions
      | Callback<
          protos.google.datastore.v1.IRollbackResponse,
          protos.google.datastore.v1.IRollbackRequest | null | undefined,
          {} | null | undefined
        >,
    callback?: Callback<
      protos.google.datastore.v1.IRollbackResponse,
      protos.google.datastore.v1.IRollbackRequest | null | undefined,
      {} | null | undefined
    >
  ): Promise<
    [
      protos.google.datastore.v1.IRollbackResponse,
      protos.google.datastore.v1.IRollbackRequest | undefined,
      {} | undefined
    ]
  > | void {
    request = request || {};
    let options: CallOptions;
    if (typeof optionsOrCallback === 'function' && callback === undefined) {
      callback = optionsOrCallback;
      options = {};
    } else {
      options = optionsOrCallback as CallOptions;
    }
    options = options || {};
    options.otherArgs = options.otherArgs || {};
    options.otherArgs.headers = options.otherArgs.headers || {};
    options.otherArgs.headers['x-goog-request-params'] =
      gax.routingHeader.fromParams({
        project_id: request.projectId || '',
      });
    this.initialize();
    return this.innerApiCalls.rollback(request, options, callback);
  }
  allocateIds(
    request: protos.google.datastore.v1.IAllocateIdsRequest,
    options?: CallOptions
  ): Promise<
    [
      protos.google.datastore.v1.IAllocateIdsResponse,
      protos.google.datastore.v1.IAllocateIdsRequest | undefined,
      {} | undefined
    ]
  >;
  allocateIds(
    request: protos.google.datastore.v1.IAllocateIdsRequest,
    options: CallOptions,
    callback: Callback<
      protos.google.datastore.v1.IAllocateIdsResponse,
      protos.google.datastore.v1.IAllocateIdsRequest | null | undefined,
      {} | null | undefined
    >
  ): void;
  allocateIds(
    request: protos.google.datastore.v1.IAllocateIdsRequest,
    callback: Callback<
      protos.google.datastore.v1.IAllocateIdsResponse,
      protos.google.datastore.v1.IAllocateIdsRequest | null | undefined,
      {} | null | undefined
    >
  ): void;
  /**
   * Allocates IDs for the given keys, which is useful for referencing an entity
   * before it is inserted.
   *
   * @param {Object} request
   *   The request object that will be sent.
   * @param {string} request.projectId
   *   Required. The ID of the project against which to make the request.
   * @param {number[]} request.keys
   *   Required. A list of keys with incomplete key paths for which to allocate IDs.
   *   No key may be reserved/read-only.
   * @param {object} [options]
   *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
   * @returns {Promise} - The promise which resolves to an array.
   *   The first element of the array is an object representing [AllocateIdsResponse]{@link google.datastore.v1.AllocateIdsResponse}.
   *   Please see the
   *   [documentation](https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods)
   *   for more details and examples.
   * @example
   * const [response] = await client.allocateIds(request);
   */
  allocateIds(
    request: protos.google.datastore.v1.IAllocateIdsRequest,
    optionsOrCallback?:
      | CallOptions
      | Callback<
          protos.google.datastore.v1.IAllocateIdsResponse,
          protos.google.datastore.v1.IAllocateIdsRequest | null | undefined,
          {} | null | undefined
        >,
    callback?: Callback<
      protos.google.datastore.v1.IAllocateIdsResponse,
      protos.google.datastore.v1.IAllocateIdsRequest | null | undefined,
      {} | null | undefined
    >
  ): Promise<
    [
      protos.google.datastore.v1.IAllocateIdsResponse,
      protos.google.datastore.v1.IAllocateIdsRequest | undefined,
      {} | undefined
    ]
  > | void {
    request = request || {};
    let options: CallOptions;
    if (typeof optionsOrCallback === 'function' && callback === undefined) {
      callback = optionsOrCallback;
      options = {};
    } else {
      options = optionsOrCallback as CallOptions;
    }
    options = options || {};
    options.otherArgs = options.otherArgs || {};
    options.otherArgs.headers = options.otherArgs.headers || {};
    options.otherArgs.headers['x-goog-request-params'] =
      gax.routingHeader.fromParams({
        project_id: request.projectId || '',
      });
    this.initialize();
    return this.innerApiCalls.allocateIds(request, options, callback);
  }
  reserveIds(
    request: protos.google.datastore.v1.IReserveIdsRequest,
    options?: CallOptions
  ): Promise<
    [
      protos.google.datastore.v1.IReserveIdsResponse,
      protos.google.datastore.v1.IReserveIdsRequest | undefined,
      {} | undefined
    ]
  >;
  reserveIds(
    request: protos.google.datastore.v1.IReserveIdsRequest,
    options: CallOptions,
    callback: Callback<
      protos.google.datastore.v1.IReserveIdsResponse,
      protos.google.datastore.v1.IReserveIdsRequest | null | undefined,
      {} | null | undefined
    >
  ): void;
  reserveIds(
    request: protos.google.datastore.v1.IReserveIdsRequest,
    callback: Callback<
      protos.google.datastore.v1.IReserveIdsResponse,
      protos.google.datastore.v1.IReserveIdsRequest | null | undefined,
      {} | null | undefined
    >
  ): void;
  /**
   * Prevents the supplied keys' IDs from being auto-allocated by Cloud
   * Datastore.
   *
   * @param {Object} request
   *   The request object that will be sent.
   * @param {string} request.projectId
   *   Required. The ID of the project against which to make the request.
   * @param {string} request.databaseId
   *   If not empty, the ID of the database against which to make the request.
   * @param {number[]} request.keys
   *   Required. A list of keys with complete key paths whose numeric IDs should not be
   *   auto-allocated.
   * @param {object} [options]
   *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
   * @returns {Promise} - The promise which resolves to an array.
   *   The first element of the array is an object representing [ReserveIdsResponse]{@link google.datastore.v1.ReserveIdsResponse}.
   *   Please see the
   *   [documentation](https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods)
   *   for more details and examples.
   * @example
   * const [response] = await client.reserveIds(request);
   */
  reserveIds(
    request: protos.google.datastore.v1.IReserveIdsRequest,
    optionsOrCallback?:
      | CallOptions
      | Callback<
          protos.google.datastore.v1.IReserveIdsResponse,
          protos.google.datastore.v1.IReserveIdsRequest | null | undefined,
          {} | null | undefined
        >,
    callback?: Callback<
      protos.google.datastore.v1.IReserveIdsResponse,
      protos.google.datastore.v1.IReserveIdsRequest | null | undefined,
      {} | null | undefined
    >
  ): Promise<
    [
      protos.google.datastore.v1.IReserveIdsResponse,
      protos.google.datastore.v1.IReserveIdsRequest | undefined,
      {} | undefined
    ]
  > | void {
    request = request || {};
    let options: CallOptions;
    if (typeof optionsOrCallback === 'function' && callback === undefined) {
      callback = optionsOrCallback;
      options = {};
    } else {
      options = optionsOrCallback as CallOptions;
    }
    options = options || {};
    options.otherArgs = options.otherArgs || {};
    options.otherArgs.headers = options.otherArgs.headers || {};
    options.otherArgs.headers['x-goog-request-params'] =
      gax.routingHeader.fromParams({
        project_id: request.projectId || '',
      });
    this.initialize();
    return this.innerApiCalls.reserveIds(request, options, callback);
  }

  /**
   * Terminate the gRPC channel and close the client.
   *
   * The client will no longer be usable and all future behavior is undefined.
   * @returns {Promise} A promise that resolves when the client is closed.
   */
  close(): Promise<void> {
    this.initialize();
    if (!this._terminated) {
      return this.datastoreStub!.then(stub => {
        this._terminated = true;
        stub.close();
      });
    }
    return Promise.resolve();
  }
}
