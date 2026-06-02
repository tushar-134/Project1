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
      <Card className="p-4 border-amber-200 bg-amber-50">
        <div className="flex gap-3 text-amber-800">
          <AlertCircle className="mt-0.5 shrink-0 text-amber-500" size={18} />
          <div className="text-[13px] leading-relaxed">
            <span className="font-bold">Inactive Clients</span>
            <br />
            These clients have been deleted from the active client list. They remain here for historical records. Restoring a client will move them back to the active list.
          </div>
        </div>
      </Card>
      
      <Card>
        <Table>
          <thead>
            <tr>
              <th>Client Name</th>
              <th>File No</th>
              <th>Jurisdiction</th>
              <th>Archived Date</th>
              <th className="w-24 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[13px] font-semibold text-slate-400">Loading...</td>
              </tr>
            ) : clients.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[13px] font-semibold text-slate-400">No inactive clients found.</td>
              </tr>
            ) : (
              clients.map((c) => (
                <tr key={c._id}>
                  <td className="font-bold text-slate-700">{c.legalName}</td>
                  <td>{c.fileNo || "—"}</td>
                  <td className="capitalize">{c.jurisdiction || "—"}</td>
                  <td>{c.updatedAt ? new Date(c.updatedAt).toLocaleDateString() : "—"}</td>
                  <td className="text-right">
                    <Button size="sm" variant="outline" onClick={() => handleRestore(c._id)}>
                      <ArchiveRestore size={14} />
                      Restore
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
