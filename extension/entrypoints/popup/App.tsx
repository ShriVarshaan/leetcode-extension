function App() {
  return (
    <div className="w-80 p-4 bg-slate-900 text-slate-100">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">LeetCode Revision Buddy</h1>
        <button
          onClick={() => browser.runtime.openOptionsPage()}
          className="rounded px-2 py-1 text-sm text-slate-300 hover:bg-slate-700"
        >
          Settings
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-400">Today's problems will show up here.</p>
    </div>
  );
}

export default App;
