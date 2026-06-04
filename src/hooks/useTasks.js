import { useCallback, useMemo, useRef } from "react";
import { useApp } from "../context/AppContext";
import { taskService } from "../services/taskService";
import { ftaStatusToApi, mapFtaTask, mapTask, statusFromApi, statusToApi } from "../utils/adapterUtils";
import { getCache, setCache, clearCache } from "../utils/apiCache";

const categoryToApi = {
  "Corporate Tax": "CT",
  "MIS Reporting": "MIS",
  "E-Invoicing": "EInv",
  "VAT Refund": "Refund",
};

function normalizeTaskParams(params = {}) {
  return {
    ...params,
    category: categoryToApi[params.category] || params.category,
    status: statusToApi[params.status] || params.status,
  };
}

export function useTasks() {
  const { state, dispatch } = useApp();
  const hasLoadedInitial = useRef(false);

  const fetchTasks = useCallback(async (params) => {
    const normalizedParams = normalizeTaskParams(params);
    const cacheKey = `tasks_${JSON.stringify(normalizedParams)}`;
    const cachedData = getCache(cacheKey);

    if (!hasLoadedInitial.current && !cachedData) {
      dispatch({ type: "SET_LOADING", resource: "tasks", value: true });
    }
    hasLoadedInitial.current = true;

    if (cachedData) {
      dispatch({ type: "SET_RESOURCE", resource: "tasks", payload: cachedData.tasks });
    }

    try {
      const data = await taskService.list(normalizedParams);
      const rawTasks = Array.isArray(data) ? data : (data.tasks || data.items || []);
      const tasks = rawTasks.map(mapTask);
      
      const result = Array.isArray(data) ? tasks : { ...data, tasks };
      
      setCache(cacheKey, { tasks, original: result });
      dispatch({ type: "SET_RESOURCE", resource: "tasks", payload: tasks });
      return result;
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        resource: "tasks",
        error: error?.response?.data?.message || "Unable to load tasks.",
      });
      throw error;
    }
  }, [dispatch]);
  const fetchFtaTracker = useCallback(async (params) => {
    const tasks = (await taskService.ftaTracker(params)).map(mapFtaTask);
    dispatch({ type: "SET_RESOURCE", resource: "ftaItems", payload: tasks });
    return tasks;
  }, [dispatch]);
  const withCacheInvalidation = useCallback((fn) => async (...args) => {
    const result = await fn(...args);
    clearCache("tasks_");
    return result;
  }, []);

  const updateStatus = useCallback(withCacheInvalidation(async (id, label) => {
    dispatch({ type: "UPDATE_TASK_STATUS", id, status: statusToApi[label], displayStatus: label });
    const task = await taskService.updateStatus(id, statusToApi[label] || label);
    const mapped = mapTask(task);
    dispatch({ type: "UPDATE_TASK_STATUS", id, status: task.status, displayStatus: statusFromApi[task.status] || task.status, isAwaitingFta: mapped.isAwaitingFta, ftaStatus: mapped.ftaStatus });
    return task;
  }), [dispatch, withCacheInvalidation]);

  const updateFtaStatus = useCallback(withCacheInvalidation(async (id, label) => {
    dispatch({ type: "UPDATE_FTA_STATUS", id, status: ftaStatusToApi[label], displayStatus: label });
    const task = await taskService.updateFtaStatus(id, ftaStatusToApi[label] || label);
    const mappedTask = mapTask(task);
    dispatch({
      type: "UPDATE_TASK_STATUS",
      id,
      status: task.status,
      displayStatus: statusFromApi[task.status] || task.status,
      isAwaitingFta: mappedTask.isAwaitingFta,
      ftaStatus: mappedTask.ftaStatus,
    });
    return task;
  }), [dispatch, withCacheInvalidation]);

  const updateAssignee = useCallback(withCacheInvalidation(async (id, assignedTo, assignedName) => {
    dispatch({ type: "UPDATE_TASK_ASSIGNEE", id, assignedTo, assigned: assignedName });
    const task = await taskService.updateAssignee(id, assignedTo);
    const mapped = mapTask(task);
    dispatch({ type: "UPDATE_TASK_ASSIGNEE", id, assignedTo: mapped.assignedId, assigned: mapped.assigned });
    return task;
  }), [dispatch, withCacheInvalidation]);

  const updateRemarks = useCallback(withCacheInvalidation(async (id, remarks) => {
    dispatch({ type: "UPDATE_TASK_REMARKS", id, remarks });
    const task = await taskService.updateRemarks(id, remarks);
    dispatch({ type: "UPDATE_TASK_REMARKS", id, remarks: task.remarks || "" });
    return task;
  }), [dispatch, withCacheInvalidation]);

  const exportTasks = useCallback((params) => taskService.export(normalizeTaskParams(params)), []);

  return useMemo(() => ({
    fetchTasks,
    fetchFtaTracker,
    getTask: taskService.get,
    createTask: withCacheInvalidation(taskService.create),
    updateTask: withCacheInvalidation(taskService.update),
    updateStatus,
    updateAssignee,
    updateRemarks,
    updateFtaStatus,
    uploadAttachment: withCacheInvalidation(taskService.uploadAttachment),
    deleteAttachment: withCacheInvalidation(taskService.deleteAttachment),
    exportTasks,
  }), [exportTasks, fetchFtaTracker, fetchTasks, updateAssignee, updateFtaStatus, updateRemarks, updateStatus, withCacheInvalidation]);
}
