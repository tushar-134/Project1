import api from "./api";

export const clientVisitService = {
  list: (params) => api.get("/client-visits", { params }).then((res) => res.data),
  create: (payload) => api.post("/client-visits", payload).then((res) => res.data),
  updateVisitorTimes: (visitId, visitorId, payload) =>
    api.patch(`/client-visits/${visitId}/visitors/${visitorId}`, payload).then((res) => res.data),
};
