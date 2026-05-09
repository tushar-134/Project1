export default function Toggle({ checked, onChange }) {
  // Toggle stays stateless so forms can control persistence and side effects from the parent.
  return (
    <button type="button" onClick={() => onChange(!checked)} className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-[#1e3a8a]" : "bg-slate-300"}`}>
      <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${checked ? "left-6" : "left-1"}`} />
    </button>
  );
}
