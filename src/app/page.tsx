export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold">FinDocs AI</h1>
      <p className="text-muted">
        Chat with financial documents. Grounded answers, inline citations,
        streamed token-by-token.
      </p>
      <p className="text-sm text-muted">Scaffold is up — UI arrives in milestone M4.</p>
    </main>
  );
}
