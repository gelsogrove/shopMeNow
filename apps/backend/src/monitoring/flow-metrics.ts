import logger from '../utils/logger';

interface FlowStepTimes {
  apiLimit: number;
  spamDetection: number;
  workspaceActive: number;
  chatbotActive: number;
  blacklistCheck: number;
  wipCheck: number;
  welcomeBackCheck: number;
  userFlow: number;
  checkoutIntent: number;
  aiProcessing: number;
}

interface FlowMetrics {
  stepTimes: FlowStepTimes;
  totalProcessingTime: number;
  outcome: 'SUCCESS' | 'BLOCKED' | 'ERROR' | 'OPERATOR_CONTROL' | 'WIP_NOTIFICATION';
  workspaceId: string;
  phoneNumber: string;
  messageLength: number;
  timestamp: number;
}

interface AggregatedMetrics {
  totalMessages: number;
  successfulMessages: number;
  blockedMessages: number;
  errorMessages: number;
  operatorControlMessages: number;
  wipNotificationMessages: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  messagesPerSecond: number;
  lastUpdated: number;
}

interface WorkspaceMetrics {
  workspaceId: string;
  messageCount: number;
  averageResponseTime: number;
  errorRate: number;
  cacheHitRate: number;
  lastActivity: number;
}

/**
 * TASK 10: Flow Metrics and Monitoring System
 * 
 * Collects, aggregates, and exposes metrics for WhatsApp message flow performance monitoring.
 * Provides real-time insights into system performance, error rates, and usage patterns.
 */
export class FlowMetricsCollector {
  private metrics: FlowMetrics[] = [];
  private aggregatedMetrics: AggregatedMetrics;
  private workspaceMetrics: Map<string, WorkspaceMetrics> = new Map();
  private readonly maxMetricsHistory = 10000; // Keep last 10k metrics
  private readonly aggregationInterval = 60000; // 1 minute
  private aggregationTimer: NodeJS.Timeout;

  constructor() {
    this.aggregatedMetrics = this.initializeAggregatedMetrics();
    
    // Start periodic aggregation
    this.aggregationTimer = setInterval(() => {
      this.aggregateMetrics();
    }, this.aggregationInterval);

    logger.info('[METRICS] FlowMetricsCollector initialized with 1-minute aggregation');
  }

  /**
   * Record metrics for a completed flow execution
   */
  recordFlowExecution(
    stepTimes: FlowStepTimes,
    outcome: FlowMetrics['outcome'],
    workspaceId: string,
    phoneNumber: string,
    messageLength: number
  ): void {
    const totalProcessingTime = Object.values(stepTimes).reduce((sum, time) => sum + time, 0);
    
    const metric: FlowMetrics = {
      stepTimes,
      totalProcessingTime,
      outcome,
      workspaceId,
      phoneNumber: this.hashPhoneNumber(phoneNumber), // Hash for privacy
      messageLength,
      timestamp: Date.now()
    };

    this.metrics.push(metric);
    this.updateWorkspaceMetrics(workspaceId, metric);

    // Maintain metrics history limit
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }

    logger.debug(`[METRICS] Recorded flow execution: ${outcome} in ${totalProcessingTime}ms for workspace ${workspaceId}`);
  }

  /**
   * Get current aggregated metrics
   */
  getAggregatedMetrics(): AggregatedMetrics {
    return { ...this.aggregatedMetrics };
  }

  /**
   * Get metrics for specific workspace
   */
  getWorkspaceMetrics(workspaceId: string): WorkspaceMetrics | null {
    return this.workspaceMetrics.get(workspaceId) || null;
  }

  /**
   * Get all workspace metrics
   */
  getAllWorkspaceMetrics(): WorkspaceMetrics[] {
    return Array.from(this.workspaceMetrics.values());
  }

  /**
   * Get recent flow metrics (last N minutes)
   */
  getRecentMetrics(minutesBack: number = 5): FlowMetrics[] {
    const cutoffTime = Date.now() - (minutesBack * 60 * 1000);
    return this.metrics.filter(m => m.timestamp > cutoffTime);
  }

  /**
   * Get performance statistics for specific time window
   */
  getPerformanceStats(minutesBack: number = 60): {
    averageResponseTime: number;
    p50ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    throughput: number;
    errorRate: number;
    successRate: number;
  } {
    const recentMetrics = this.getRecentMetrics(minutesBack);
    
    if (recentMetrics.length === 0) {
      return {
        averageResponseTime: 0,
        p50ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        throughput: 0,
        errorRate: 0,
        successRate: 0
      };
    }

    const responseTimes = recentMetrics.map(m => m.totalProcessingTime).sort((a, b) => a - b);
    const successfulMessages = recentMetrics.filter(m => m.outcome === 'SUCCESS').length;
    const errorMessages = recentMetrics.filter(m => m.outcome === 'ERROR').length;
    
    const timeWindowSeconds = minutesBack * 60;
    const throughput = recentMetrics.length / timeWindowSeconds;

    return {
      averageResponseTime: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
      p50ResponseTime: this.getPercentile(responseTimes, 50),
      p95ResponseTime: this.getPercentile(responseTimes, 95),
      p99ResponseTime: this.getPercentile(responseTimes, 99),
      throughput,
      errorRate: (errorMessages / recentMetrics.length) * 100,
      successRate: (successfulMessages / recentMetrics.length) * 100
    };
  }

  /**
   * Get step-by-step performance breakdown
   */
  getStepPerformanceBreakdown(minutesBack: number = 60): Record<keyof FlowStepTimes, {
    average: number;
    p95: number;
    percentage: number;
  }> {
    const recentMetrics = this.getRecentMetrics(minutesBack);
    
    if (recentMetrics.length === 0) {
      return {} as any;
    }

    const stepKeys = Object.keys(recentMetrics[0].stepTimes) as (keyof FlowStepTimes)[];
    const breakdown: any = {};

    for (const stepKey of stepKeys) {
      const stepTimes = recentMetrics.map(m => m.stepTimes[stepKey]).sort((a, b) => a - b);
      const average = stepTimes.reduce((sum, time) => sum + time, 0) / stepTimes.length;
      const totalAverage = recentMetrics.reduce((sum, m) => sum + m.totalProcessingTime, 0) / recentMetrics.length;
      
      breakdown[stepKey] = {
        average: Math.round(average * 100) / 100,
        p95: this.getPercentile(stepTimes, 95),
        percentage: Math.round((average / totalAverage) * 100 * 100) / 100
      };
    }

    return breakdown;
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheusMetrics(): string {
    const stats = this.getPerformanceStats(5); // Last 5 minutes
    const aggregated = this.getAggregatedMetrics();
    
    const metrics = [
      `# HELP whatsapp_flow_messages_total Total number of messages processed`,
      `# TYPE whatsapp_flow_messages_total counter`,
      `whatsapp_flow_messages_total ${aggregated.totalMessages}`,
      ``,
      `# HELP whatsapp_flow_response_time_seconds Response time in seconds`,
      `# TYPE whatsapp_flow_response_time_seconds histogram`,
      `whatsapp_flow_response_time_seconds_sum ${stats.averageResponseTime / 1000}`,
      `whatsapp_flow_response_time_seconds_count ${aggregated.totalMessages}`,
      ``,
      `# HELP whatsapp_flow_throughput_messages_per_second Current throughput`,
      `# TYPE whatsapp_flow_throughput_messages_per_second gauge`,
      `whatsapp_flow_throughput_messages_per_second ${stats.throughput}`,
      ``,
      `# HELP whatsapp_flow_error_rate_percent Current error rate percentage`,
      `# TYPE whatsapp_flow_error_rate_percent gauge`,
      `whatsapp_flow_error_rate_percent ${stats.errorRate}`,
      ``,
      `# HELP whatsapp_flow_success_rate_percent Current success rate percentage`,
      `# TYPE whatsapp_flow_success_rate_percent gauge`,
      `whatsapp_flow_success_rate_percent ${stats.successRate}`,
    ];

    // Add workspace-specific metrics
    for (const workspace of this.workspaceMetrics.values()) {
      metrics.push(
        `whatsapp_flow_workspace_messages_total{workspace_id="${workspace.workspaceId}"} ${workspace.messageCount}`,
        `whatsapp_flow_workspace_response_time_ms{workspace_id="${workspace.workspaceId}"} ${workspace.averageResponseTime}`,
        `whatsapp_flow_workspace_error_rate{workspace_id="${workspace.workspaceId}"} ${workspace.errorRate}`
      );
    }

    return metrics.join('\n');
  }

  /**
   * Get health check status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: {
      averageResponseTime: number;
      errorRate: number;
      throughput: number;
      recentMessages: number;
    };
    issues: string[];
  } {
    const stats = this.getPerformanceStats(5);
    const recentMetrics = this.getRecentMetrics(5);
    const issues: string[] = [];
    
    // Health thresholds
    const maxResponseTime = 1000; // 1 second
    const maxErrorRate = 5; // 5%
    const minThroughput = 0.1; // 0.1 messages/second
    
    if (stats.averageResponseTime > maxResponseTime) {
      issues.push(`High response time: ${stats.averageResponseTime}ms > ${maxResponseTime}ms`);
    }
    
    if (stats.errorRate > maxErrorRate) {
      issues.push(`High error rate: ${stats.errorRate}% > ${maxErrorRate}%`);
    }
    
    if (recentMetrics.length > 0 && stats.throughput < minThroughput) {
      issues.push(`Low throughput: ${stats.throughput} msg/s < ${minThroughput} msg/s`);
    }

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (issues.length > 0) {
      status = issues.length > 2 ? 'unhealthy' : 'degraded';
    }

    return {
      status,
      metrics: {
        averageResponseTime: Math.round(stats.averageResponseTime),
        errorRate: Math.round(stats.errorRate * 100) / 100,
        throughput: Math.round(stats.throughput * 100) / 100,
        recentMessages: recentMetrics.length
      },
      issues
    };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
    }
    this.metrics = [];
    this.workspaceMetrics.clear();
    logger.info('[METRICS] FlowMetricsCollector destroyed');
  }

  private initializeAggregatedMetrics(): AggregatedMetrics {
    return {
      totalMessages: 0,
      successfulMessages: 0,
      blockedMessages: 0,
      errorMessages: 0,
      operatorControlMessages: 0,
      wipNotificationMessages: 0,
      averageResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      messagesPerSecond: 0,
      lastUpdated: Date.now()
    };
  }

  private aggregateMetrics(): void {
    const recentMetrics = this.getRecentMetrics(60); // Last hour
    
    if (recentMetrics.length === 0) {
      return;
    }

    const responseTimes = recentMetrics.map(m => m.totalProcessingTime).sort((a, b) => a - b);
    
    this.aggregatedMetrics = {
      totalMessages: this.metrics.length,
      successfulMessages: recentMetrics.filter(m => m.outcome === 'SUCCESS').length,
      blockedMessages: recentMetrics.filter(m => m.outcome === 'BLOCKED').length,
      errorMessages: recentMetrics.filter(m => m.outcome === 'ERROR').length,
      operatorControlMessages: recentMetrics.filter(m => m.outcome === 'OPERATOR_CONTROL').length,
      wipNotificationMessages: recentMetrics.filter(m => m.outcome === 'WIP_NOTIFICATION').length,
      averageResponseTime: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
      p95ResponseTime: this.getPercentile(responseTimes, 95),
      p99ResponseTime: this.getPercentile(responseTimes, 99),
      messagesPerSecond: recentMetrics.length / 3600, // Messages per second in last hour
      lastUpdated: Date.now()
    };

    logger.debug(`[METRICS] Aggregated metrics updated: ${recentMetrics.length} messages in last hour`);
  }

  private updateWorkspaceMetrics(workspaceId: string, metric: FlowMetrics): void {
    const existing = this.workspaceMetrics.get(workspaceId);
    
    if (existing) {
      const newCount = existing.messageCount + 1;
      const newAvgResponseTime = ((existing.averageResponseTime * existing.messageCount) + metric.totalProcessingTime) / newCount;
      const errorCount = metric.outcome === 'ERROR' ? 1 : 0;
      const newErrorRate = existing.errorRate + ((errorCount - existing.errorRate) / newCount);
      
      this.workspaceMetrics.set(workspaceId, {
        ...existing,
        messageCount: newCount,
        averageResponseTime: newAvgResponseTime,
        errorRate: newErrorRate,
        lastActivity: Date.now()
      });
    } else {
      this.workspaceMetrics.set(workspaceId, {
        workspaceId,
        messageCount: 1,
        averageResponseTime: metric.totalProcessingTime,
        errorRate: metric.outcome === 'ERROR' ? 1 : 0,
        cacheHitRate: 0, // Will be updated by cache service
        lastActivity: Date.now()
      });
    }
  }

  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  private hashPhoneNumber(phoneNumber: string): string {
    // Simple hash for privacy (in production, use proper hashing)
    return phoneNumber.replace(/\d/g, 'X').substring(0, 10);
  }
}

// Global metrics collector instance
export const flowMetrics = new FlowMetricsCollector(); 