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
  async function fetchTasks(params) {
    dispatch({ type: "SET_LOADING", resource: "tasks", value: true });
    const tasks = (await taskService.list(normalizeTaskParams(params))).map(mapTask);
    dispatch({ type: "SET_RESOURCE", resource: "tasks", payload: tasks });
    return tasks;
  }
  async function fetchFtaTracker(params) {
    const tasks = (await taskService.ftaTracker(params)).map(mapFtaTask);
    dispatch({ type: "SET_RESOURCE", resource: "ftaItems", payload: tasks });
    return tasks;
  }
  async function updateStatus(id, label) {
    // Status updates are optimistic because the task list is designed for quick inline changes.
    dispatch({ type: "UPDATE_TASK_STATUS", id, status: statusToApi[label], displayStatus: label });
    const task = await taskService.updateStatus(id, statusToApi[label] || label);
    dispatch({ type: "UPDATE_TASK_STATUS", id, status: task.status, displayStatus: statusFromApi[task.status] || task.status });
    return task;
  }
  async function updateFtaStatus(id, label) {
    dispatch({ type: "UPDATE_FTA_STATUS", id, status: ftaStatusToApi[label], displayStatus: label });
    return taskService.updateFtaStatus(id, ftaStatusToApi[label] || label);
  }
  return { fetchTasks, fetchFtaTracker, getTask: taskService.get, createTask: taskService.create, updateTask: taskService.update, updateStatus, updateFtaStatus, exportTasks: (params) => taskService.export(normalizeTaskParams(params)) };
}
