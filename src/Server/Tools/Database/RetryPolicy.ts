import * as util from 'util';

import * as cassandra from 'cassandra-driver';

class Retry implements cassandra.policies.retry.RetryPolicy {
  
  //--------------------------------------------//
  
  //--------------------------------------------//
  
  //--------------------------------------------//
  
  public onReadTimeout(
    requestInfo: cassandra.policies.retry.RequestInfo,
    consistency: cassandra.types.consistencies,
    received: number,
    blockFor: number,
    isDataPresent: boolean
  ) : cassandra.policies.retry.DecisionInfo {
    
    // TODO : base on development or production
    return {
      decision: cassandra.policies.retry.RetryPolicy.retryDecision.retry,
      consistency: cassandra.types.consistencies.one
    }
    
  }
  
  onUnavailable(
    requestInfo: cassandra.policies.retry.RequestInfo,
    consistency: cassandra.types.consistencies,
    required: number,
    alive: number
  ): cassandra.policies.retry.DecisionInfo {
    
    // TODO : base on development or production
    return {
      decision: cassandra.policies.retry.RetryPolicy.retryDecision.retry,
      consistency: cassandra.types.consistencies.one
    }
    
  }
  
  onWriteTimeout(
    requestInfo: cassandra.policies.retry.RequestInfo,
    consistency: cassandra.types.consistencies,
    received: number,
    blockFor: number,
    writeType: string
  ): cassandra.policies.retry.DecisionInfo {
    
    // TODO : base on development or production
    return {
      decision: cassandra.policies.retry.RetryPolicy.retryDecision.retry,
      consistency: cassandra.types.consistencies.one
    }
    
  }
  
  rethrowResult(): { decision: cassandra.policies.retry.retryDecision } {
    
    // TODO : base on development or production
    return {
      decision: cassandra.policies.retry.RetryPolicy.retryDecision.retry
    }
    
  }
  
  retryResult(): { decision: cassandra.policies.retry.retryDecision, consistency: cassandra.types.consistencies, useCurrentHost: boolean } {
    
    // TODO : base on development or production
    return {
      decision: cassandra.policies.retry.RetryPolicy.retryDecision.retry,
      consistency: cassandra.types.consistencies.one,
      useCurrentHost: true
    }
    
  }
  
  //--------------------------------------------//
  
}

// need to add RetryPolicy to the classes prototype chain
util.inherits(Retry, (<any>cassandra.policies.retry).RetryPolicy);

export const RetryPolicy = Retry;
