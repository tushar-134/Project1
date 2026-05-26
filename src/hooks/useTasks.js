import { useCallback, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { taskService } from "../services/taskService";
import { ftaStatusToApi, mapFtaTask, mapTask, statusFromApi, statusToApi } from "../utils/adapterUtils";

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
  const { dispatch } = useApp();
  const fetchTasks = useCallback(async (params) => {
    dispatch({ type: "SET_LOADING", resource: "tasks", value: true });
    try {
      const data = await taskService.list(normalizeTaskParams(params));
      const rawTasks = Array.isArray(data) ? data : (data.tasks || data.items || []);
      const tasks = rawTasks.map(mapTask);
      dispatch({ type: "SET_RESOURCE", resource: "tasks", payload: tasks });
      return Array.isArray(data) ? tasks : { ...data, tasks };
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
  const updateStatus = useCallback(async (id, label) => {
    // Status updates are optimistic because the task list is designed for quick inline changes.
    dispatch({ type: "UPDATE_TASK_STATUS", id, status: statusToApi[label], displayStatus: label });
    const task = await taskService.updateStatus(id, statusToApi[label] || label);
    // Selecting "Submitted to FTA" auto-sets isAwaitingFta=true on the backend — sync it here.
    const mapped = mapTask(task);
    dispatch({ type: "UPDATE_TASK_STATUS", id, status: task.status, displayStatus: statusFromApi[task.status] || task.status, isAwaitingFta: mapped.isAwaitingFta, ftaStatus: mapped.ftaStatus });
    return task;
  }, [dispatch]);
  const updateFtaStatus = useCallback(async (id, label) => {
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
  }, [dispatch]);
  const updateAssignee = useCallback(async (id, assignedTo, assignedName) => {
    // Optimistic update — show new name immediately
    dispatch({ type: "UPDATE_TASK_ASSIGNEE", id, assignedTo, assigned: assignedName });
    const task = await taskService.updateAssignee(id, assignedTo);
    const mapped = mapTask(task);
    dispatch({ type: "UPDATE_TASK_ASSIGNEE", id, assignedTo: mapped.assignedId, assigned: mapped.assigned });
    return task;
  }, [dispatch]);
  const updateRemarks = useCallback(async (id, remarks) => {
    dispatch({ type: "UPDATE_TASK_REMARKS", id, remarks });
    const task = await taskService.updateRemarks(id, remarks);
    dispatch({ type: "UPDATE_TASK_REMARKS", id, remarks: task.remarks || "" });
    return task;
  }, [dispatch]);

  const exportTasks = useCallback((params) => taskService.export(normalizeTaskParams(params)), []);

  return useMemo(() => ({
    fetchTasks,
    fetchFtaTracker,
    getTask: taskService.get,
    createTask: taskService.create,
    updateTask: taskService.update,
    updateStatus,
    updateAssignee,
    updateRemarks,
    updateFtaStatus,
    uploadAttachment: taskService.uploadAttachment,
    deleteAttachment: taskService.deleteAttachment,
    exportTasks,
  }), [exportTasks, fetchFtaTracker, fetchTasks, updateAssignee, updateFtaStatus, updateRemarks, updateStatus]);
}
