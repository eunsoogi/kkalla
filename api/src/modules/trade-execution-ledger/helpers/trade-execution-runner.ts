export async function executeTradesSequentiallyWithRequests<TRequest, TTrade>(
  requests: TRequest[],
  executeTrade: (request: TRequest) => Promise<TTrade>,
  lockGuard?: (() => void) | null,
): Promise<Array<{ request: TRequest; trade: TTrade }>> {
  const assertLockOrThrow = typeof lockGuard === 'function' ? lockGuard : () => undefined;
  const executions: Array<{ request: TRequest; trade: TTrade }> = [];

  for (const request of requests) {
    assertLockOrThrow();
    const trade = await executeTrade(request);
    assertLockOrThrow();
    executions.push({ request, trade });
  }

  return executions;
}
