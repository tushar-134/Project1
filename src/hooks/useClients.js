import { useCallback, useMemo } from "react";
import { clientService } from "../services/clientService";
import { useApp } from "../context/AppContext";
import { mapClient } from "../utils/adapterUtils";

export function useClients() {
  const { dispatch } = useApp();
  const fetchClients = useCallback(async (params) => {
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
  }, [dispatch]);

  return useMemo(() => ({
    fetchClients,
    getClient: clientService.get,
    createClient: clientService.create,
    updateClient: clientService.update,
    deleteClient: clientService.remove,
    bulkUpload: clientService.bulkUpload,
    bulkUploadV2: clientService.bulkUploadV2,
    exportClients: clientService.export,
    uploadAttachment: clientService.uploadAttachment,
    uploadDocument: clientService.uploadDocument,
    deleteAttachment: clientService.deleteAttachment,
    deleteDocument: clientService.deleteDocument,
  }), [fetchClients]);
}
