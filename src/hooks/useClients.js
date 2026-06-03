import { useCallback, useMemo } from "react";
import { clientService } from "../services/clientService";
import { useApp } from "../context/AppContext";
import { mapClient } from "../utils/adapterUtils";
import { getCache, setCache, clearCache } from "../utils/apiCache";

export function useClients() {
  const { state, dispatch } = useApp();

  const fetchClients = useCallback(async (params) => {
    const cacheKey = `clients_${JSON.stringify(params || {})}`;
    const cachedData = getCache(cacheKey);

    const isFirstLoad = !state.clients || state.clients.length === 0;
    
    // Only show loading spinner if it's the first load and we don't have cached data
    if (isFirstLoad && !cachedData) {
      dispatch({ type: "SET_LOADING", resource: "clients", value: true });
    }

    if (cachedData) {
      dispatch({ type: "SET_RESOURCE", resource: "clients", payload: cachedData.clients });
      // We can return cachedData.original immediately, but we still fetch in the background (SWR)
    }

    try {
      const data = await clientService.list(params);
      const rawClients = Array.isArray(data) ? data : (data.clients || data.items || []);
      const clients = rawClients.map(mapClient);
      
      const result = Array.isArray(data) ? clients : { ...data, clients, workingTasksTotal: data.workingTasksTotal || 0 };
      
      setCache(cacheKey, { clients, original: result });
      dispatch({ type: "SET_RESOURCE", resource: "clients", payload: clients });
      return result;
    } catch (error) {
      dispatch({ type: "SET_ERROR", resource: "clients", error });
      throw error;
    }
  }, [dispatch, state.clients]);

  // Wrap mutations to invalidate cache
  const withCacheInvalidation = useCallback((fn) => async (...args) => {
    const result = await fn(...args);
    clearCache("clients_");
    return result;
  }, []);

  return useMemo(() => ({
    fetchClients,
    getClient: clientService.get,
    createClient: withCacheInvalidation(clientService.create),
    updateClient: withCacheInvalidation(clientService.update),
    deleteClient: withCacheInvalidation(clientService.remove),
    restoreClient: withCacheInvalidation(clientService.restore),
    bulkUpload: withCacheInvalidation(clientService.bulkUpload),
    exportClients: clientService.export,
    uploadAttachment: clientService.uploadAttachment,
    uploadDocument: clientService.uploadDocument,
    deleteAttachment: clientService.deleteAttachment,
    deleteDocument: clientService.deleteDocument,
  }), [fetchClients, withCacheInvalidation]);
}
