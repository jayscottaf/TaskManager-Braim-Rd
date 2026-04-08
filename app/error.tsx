"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-red-200 p-6 max-w-md w-full">
        <h2 className="text-lg font-bold text-red-600 mb-2">Something went wrong</h2>
        <pre className="text-sm text-gray-700 bg-gray-50 rounded p-3 overflow-auto mb-4 whitespace-pre-wrap">
          {error.message}
        </pre>
        <button
          onClick={reset}
          className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
