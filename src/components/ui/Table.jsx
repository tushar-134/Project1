export default function Table({ children, className = "" }) {
  // Shared table wrapper keeps horizontal overflow behavior consistent across admin screens.
  return <div className={`w-full overflow-x-auto ${className}`}><table className="table min-w-max">{children}</table></div>;
}
