export default function Card({ children, className = "", ...props }) {
  // Card stays intentionally thin: it only owns framing, while screens own layout inside the frame.
  return <div className={`rounded-xl border border-[#e2e8f0] bg-white shadow-[0_1px_4px_rgba(0,0,0,.06)] ${className}`} {...props}>{children}</div>;
}
