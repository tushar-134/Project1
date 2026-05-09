import { clientService } from "../services/clientService";
import { useApp } from "../context/AppContext";
import { mapClient } from "../utils/adapterUtils";

export function useClients() {
  const { dispatch } = useApp();
  async function fetchClients(params) {
    // Hooks own request state updates so screens can focus on filters and user actions.
    dispatch({ type: "SET_LOADING", resource: "clients", value: true });
    try {
      const data = await clientService.list(params);
      const clients = (data.clients || data).map(mapClient);
      dispatch({ type: "SET_RESOURCE", resource: "clients", payload: clients });
      return data;
    } catch (error) {
      dispatch({ type: "SET_ERROR", resource: "clients", error });
      throw error;
    }
  }
  return {
    fetchClients,
    getClient: clientService.get,
    createClient: clientService.create,
    updateClient: clientService.update,
    deleteClient: clientService.remove,
    bulkUpload: clientService.bulkUpload,
    exportClients: clientService.export,
  };
}
