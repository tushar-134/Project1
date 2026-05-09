export default function Table({ children, className = "" }) {
  // Shared table wrapper keeps horizontal overflow behavior consistent across admin screens.
  return <div className={`overflow-x-auto ${className}`}><table className="table">{children}</table></div>;
}
