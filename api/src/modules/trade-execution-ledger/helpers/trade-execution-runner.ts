/**
 * Runs trades sequentially with requests in the trade execution ledger workflow.
 * @param requests - Input value for requests.
 * @param executeTrade - Input value for execute trade.
 * @param lockGuard - Lock data used for concurrency control.
 * @returns Processed collection for downstream workflow steps.
 */
export async function executeTradesSequentiallyWithRequests<TRequest, TTrade>(
  requests: TRequest[],
  executeTrade: (request: TRequest) => Promise<TTrade>,
  lockGuard?: (() => void) | null,
): Promise<Array<{ request: TRequest; trade: TTrade }>> {
  const assertLockOrThrow = typeof lockGuard === 'function' ? lockGuard : () => undefined;
  const executions: Array<{ request: TRequest; trade: TTrade }> = [];

  for (const request of requests) {
    // Guard both before and after execution to catch lock loss during long API calls.
    assertLockOrThrow();
    const trade = await executeTrade(request);
    assertLockOrThrow();
    executions.push({ request, trade });
  }

  return executions;
}
