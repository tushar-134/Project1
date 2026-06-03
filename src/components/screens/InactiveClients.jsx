import { ArchiveRestore, AlertCircle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { clientService } from "../../services/clientService.js";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import Table from "../ui/Table.jsx";

export default function InactiveClients({ setSettingsHeaderAction }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchInactive = async () => {
    setLoading(true);
    try {
      const res = await clientService.list({ status: "inactive", limit: 100 });
      setClients(res.clients || []);
    } catch (error) {
      toast.error("Failed to load inactive clients.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInactive();
  }, []);

  useEffect(() => {
    if (setSettingsHeaderAction) {
      setSettingsHeaderAction(
        <Button variant="ghost" onClick={fetchInactive} disabled={loading}>
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      );
      return () => setSettingsHeaderAction(null);
    }
  }, [setSettingsHeaderAction, loading]);

  const handleRestore = async (id) => {
    try {
      await clientService.restore(id);
      toast.success("Client restored successfully!");
      fetchInactive();
    } catch (error) {
      toast.error("Failed to restore client.");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <Table>
          <thead>
            <tr>
              <th>Client Name</th>
              <th>File No</th>
              <th>Jurisdiction</th>
              <th>Archived Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-[13px] font-semibold text-slate-400">Loading...</td>
              </tr>
            ) : clients.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-[13px] font-semibold text-slate-400">No inactive clients found.</td>
              </tr>
            ) : (
              clients.map((c) => (
                <tr key={c._id}>
                  <td className="font-bold text-slate-700">{c.legalName}</td>
                  <td>{c.fileNo || "—"}</td>
                  <td className="capitalize">{c.jurisdiction || "—"}</td>
                  <td>{c.updatedAt ? new Date(c.updatedAt).toLocaleDateString() : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
