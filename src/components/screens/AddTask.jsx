import { cloneElement, isValidElement, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Check, ChevronDown, Send, UploadCloud, X } from "lucide-react";
import toast from "react-hot-toast";
import { useApp } from "../../context/AppContext.jsx";
import { useClients } from "../../hooks/useClients";
import { useUsers } from "../../hooks/useUsers";
import { useTasks } from "../../hooks/useTasks";
import { categoryService } from "../../services/categoryService";
import { mapCategory } from "../../utils/adapterUtils";
import { getFYOptions, getQuarters, getCurrentFYAndQuarter } from "../../utils/periodUtils";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import Toggle from "../ui/Toggle.jsx";

export default function AddTask() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const isEditMode = Boolean(id);
  const prefillTask = location.state?.prefillTask || null;
  const returnToClient = location.state?.returnToClient || null;
  const { fetchClients } = useClients();
  const { fetchUsers } = useUsers();
  const { createTask, getTask, updateTask, uploadAttachment, deleteAttachment } = useTasks();
  // If navigated from TaskList with prefetched task data, start directly at step 3 (no flash).
  const [step, setStep] = useState(() => ((isEditMode && location.state?.task) || (!isEditMode && prefillTask)) ? 3 : 1);
  const [categoryId, setCategoryId] = useState(prefillTask?.categoryId || "vat");
  const [categoryName, setCategoryName] = useState(prefillTask?.categoryName || "VAT");
  const category = state.categories.find((cat) => cat.id === categoryId);
  const [type, setType] = useState(prefillTask?.type || "VAT Return");
  const [recurring, setRecurring] = useState(false);
  const [fta, setFta] = useState(false);
  const [savedStatus, setSavedStatus] = useState("not_started");
  const [submitting, setSubmitting] = useState(false);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [attachmentDescription, setAttachmentDescription] = useState("");
  const [details, setDetails] = useState({
    client: prefillTask?.clientId || "",
    assigned: "",
    dueDate: "2026-05-31",
    periodFY: "",
    periodQuarter: "",
    description: prefillTask?.description || "",
    frequency: "monthly",
    dayOfWeek: "Sun",
    dateOfMonth: 1,
    monthOfYear: 1,
    nextDue: "2026-06-30",
    endDate: ""
  });
  const chips = useMemo(() => category?.taskTypes || [], [category]);

  // Derive field-visibility config from the selected task type's saved toggles.
  // Falls back to true so existing task types (which have DB default true) keep all fields visible.
  const selectedRawType = useMemo(() => {
    const raw = category?.rawTaskTypes || [];
    return raw.find((t) => t.name === type) || null;
  }, [category, type]);
  const showPeriod = selectedRawType ? (selectedRawType.showPeriod !== false) : true;
  const showRecurring = selectedRawType ? (selectedRawType.showRecurring !== false) : true;
  const showAwaitingFta = selectedRawType ? (selectedRawType.showAwaitingFta !== false) : true;

  // Derive FY + Quarter options from the selected client's financialYearEnd.
  const selectedClient = useMemo(
    () => state.clients.find((c) => (c._id || c.id) === details.client) || null,
    [state.clients, details.client]
  );
  const clientFYE = selectedClient?.financialYearEnd || "Jan - Dec";
  const fyOptions = useMemo(() => getFYOptions(clientFYE), [clientFYE]);
  const quarterOptions = useMemo(() => getQuarters(clientFYE), [clientFYE]);
  useEffect(() => {
    // The task wizard needs lookup data up front so each step can stay synchronous and snappy.
    fetchClients({ limit: 100 }).catch(() => { });
    fetchUsers().catch(() => { });
    categoryService.list().then((data) => dispatch({ type: "SET_RESOURCE", resource: "categories", payload: data.map(mapCategory) })).catch(() => { });
  }, []);

  // Auto-populate FY and Quarter once a client is selected (new tasks only).
  // Clears the fields when client is deselected; re-computes when client changes.
  useEffect(() => {
    if (isEditMode) return;
    if (!details.client) {
      setDetails((prev) => ({ ...prev, periodFY: "", periodQuarter: "" }));
      return;
    }
    const { fy, quarter } = getCurrentFYAndQuarter(clientFYE);
    setDetails((prev) => ({ ...prev, periodFY: fy, periodQuarter: quarter }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details.client, clientFYE, isEditMode]);
  useEffect(() => {
    if (!isEditMode) return;

    function populate(task) {
      const categoryMap = {
        VAT: "vat",
        CT: "ct",
        "Corporate Tax": "ct",
        Audit: "audit",
        Accounting: "accounting",
        MIS: "mis",
        "MIS Reporting": "mis",
        EInv: "einv",
        "E-Invoicing": "einv",
        Refund: "refund",
        "VAT Refund": "refund",
        Other: "other",
      };
      const nextCategoryId = categoryMap[task.category] || String(task.category || "").toLowerCase();
      setCategoryId(nextCategoryId);
      setCategoryName(task.category || "VAT");
      setType(task.taskType || task.type || "");
      setRecurring(Boolean(task.isRecurring ?? task.recurring));
      setFta(Boolean(task.isAwaitingFta));
      // Handle both mapped shape (apiStatus) and raw API shape (status enum)
      setSavedStatus(task.apiStatus || task.status || "not_started");
      setDetails({
        // Handle both mapped shape (clientId) and raw API shape (client._id)
        client: task.client?._id || task.clientId || (typeof task.client === "string" ? "" : task.client) || "",
        // Handle both mapped shape (assignedId) and raw API shape (assignedTo._id)
        assigned: task.assignedTo?._id || task.assignedId || (typeof task.assignedTo === "string" ? task.assignedTo : "") || "",
        dueDate: task.dueDate?.slice?.(0, 10) || "",
        periodFY: task.periodFY || "",
        periodQuarter: task.periodQuarter || "",
        description: task.description || "",
        frequency: task.recurringConfig?.frequency || "monthly",
        dayOfWeek: task.recurringConfig?.dayOfWeek || "Sun",
        dateOfMonth: task.recurringConfig?.dateOfMonth || 1,
        monthOfYear: task.recurringConfig?.monthOfYear || 1,
        nextDue: task.recurringConfig?.nextDueDate?.slice?.(0, 10) || "",
        endDate: task.recurringConfig?.endDate?.slice?.(0, 10) || "",
      });
      setAttachments(mapAttachmentRows(task.attachments || []));
      setStep(3);
    }

    const prefetched = location.state?.task;
    if (prefetched) {
      populate(prefetched);
    }
    getTask(id).then(populate).catch(() => {
      if (!prefetched) {
        toast.error("Unable to load this task for editing.");
        navigate("/tasks/list");
      }
    });
  }, [id, isEditMode]);

  useEffect(() => {
    if (isEditMode || !prefillTask) return;
    setCategoryId(prefillTask.categoryId || "vat");
    setCategoryName(prefillTask.categoryName || "VAT");
    setType(prefillTask.type || "VAT Return");
    setStep(3);
    setDetails((current) => ({
      ...current,
      client: prefillTask.clientId || current.client,
      description: prefillTask.description || current.description,
    }));
  }, [isEditMode, prefillTask]);

  useEffect(() => {
    if (!state.categories.length || !categoryName) return;
    const resolved = state.categories.find((cat) => cat.id === categoryId)
      || state.categories.find((cat) => cat.name === categoryName);
    if (resolved && resolved.id !== categoryId) setCategoryId(resolved.id);
  }, [state.categories, categoryId, categoryName]);

  const handleRecurrenceChange = (updatedFields) => {
    const nextDetails = { ...details, ...updatedFields };
    const nextDue = calculateFrontendNextDue(
      nextDetails.dueDate,
      nextDetails.frequency,
      nextDetails.dayOfWeek,
      nextDetails.dateOfMonth,
      nextDetails.monthOfYear
    );
    setDetails({ ...nextDetails, nextDue });
  };

  function selectCategory(id) {
    const next = state.categories.find((cat) => cat.id === id);
    setCategoryId(id);
    setCategoryName(next?.name || categoryName);
    setType(next.taskTypes[0] || "");
    setStep(2);
  }

  async function handleAttachmentFiles(files, description = "") {
    const selected = Array.from(files || []);
    if (!selected.length) return;
    const note = String(description || "").trim();

    if (!id) {
      setAttachments((current) => [
        ...current,
        ...selected.map((file) => toPendingAttachment(file, note)),
      ]);
      setAttachmentDescription("");
      toast.success(selected.length === 1 ? "Attachment added. You can open it immediately." : "Attachments added. You can open them immediately.");
      return;
    }

    setIsUploadingAttachments(true);
    try {
      const formData = new FormData();
      selected.forEach((file) => formData.append("files", file));
      formData.append("description", note);
      const updatedTask = await uploadAttachment(id, formData);
      setAttachments(mapAttachmentRows(updatedTask.attachments || []));
      setAttachmentDescription("");
      toast.success(selected.length === 1 ? "Attachment uploaded." : "Attachments uploaded.");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Attachment upload failed.");
    } finally {
      setIsUploadingAttachments(false);
    }
  }

  async function removeAttachment(attachment) {
    if (!attachment.saved) {
      setAttachments((current) => current.filter((item) => item.id !== attachment.id));
      return;
    }
    try {
      const updatedTask = await deleteAttachment(id, attachment.id);
      setAttachments(mapAttachmentRows(updatedTask.attachments || []));
      toast.success("Attachment deleted.");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to delete attachment.");
    }
  }

  async function submit() {
    if (submitting) return; // guard against double-clicks
    if (!details.client) {
      toast.error("Please select a client before submitting the task.");
      return;
    }
    if (!details.dueDate) {
      toast.error("Please choose a due date before submitting the task.");
      return;
    }
    setSubmitting(true);
    try {
      const resolvedCategory = state.categories.find((cat) => cat.id === categoryId)
        || state.categories.find((cat) => cat.name === categoryName);
      if (!resolvedCategory) {
        toast.error("Please choose the task category again before saving.");
        setStep(1);
        return;
      }
      // Resolve effective values — reset hidden fields so they don't accidentally persist.
      const effectiveRecurring = showRecurring ? recurring : false;
      const effectiveFta = showAwaitingFta ? fta : false;
      const payload = {
        category: resolvedCategory.name,
        taskType: type,
        client: details.client,
        assignedTo: details.assigned || undefined,
        dueDate: details.dueDate,
        // Structured period fields — send only when the Period section is visible.
        periodFY: showPeriod ? (details.periodFY || undefined) : undefined,
        periodQuarter: showPeriod ? (details.periodQuarter || undefined) : undefined,
        description: details.description,
        isRecurring: effectiveRecurring,
        recurringConfig: effectiveRecurring ? {
          frequency: details.frequency,
          dayOfWeek: details.frequency === "weekly" ? details.dayOfWeek : undefined,
          dateOfMonth: (details.frequency === "monthly" || details.frequency === "quarterly" || details.frequency === "annual") ? details.dateOfMonth : undefined,
          monthOfYear: details.frequency === "annual" ? details.monthOfYear : undefined,
          nextDueDate: details.nextDue,
          endDate: details.endDate || undefined
        } : undefined,
        isAwaitingFta: effectiveFta,
        // In edit mode, preserve the current status — don't override it just because FTA toggle is on.
        // In create mode, auto-set to submitted_to_fta if FTA toggle is on, else not_started.
        status: isEditMode ? savedStatus : (effectiveFta ? "submitted_to_fta" : "not_started"),
      };
      let savedTask;
      if (isEditMode) {
        savedTask = await updateTask(id, payload);
      } else {
        savedTask = await createTask(payload);
      }

      const pendingAttachments = attachments.filter((attachment) => !attachment.saved && attachment.file);
      if (pendingAttachments.length) {
        const groupedByDescription = pendingAttachments.reduce((acc, attachment) => {
          const key = attachment.description || "";
          if (!acc[key]) acc[key] = [];
          acc[key].push(attachment.file);
          return acc;
        }, {});
        const taskId = savedTask?._id || id;
        for (const [description, files] of Object.entries(groupedByDescription)) {
          const formData = new FormData();
          files.forEach((file) => formData.append("files", file));
          formData.append("description", description);
          savedTask = await uploadAttachment(taskId, formData);
        }
        setAttachments(mapAttachmentRows(savedTask?.attachments || []));
      }
      toast.success(isEditMode ? "Task updated successfully." : "Task created successfully.");
      if (!isEditMode && returnToClient?.clientId && savedTask?._id) {
        navigate(`/clients/edit/${returnToClient.clientId}`, {
          state: {
            activeTab: Number(returnToClient.activeTab) || 3,
            createdRegistrationTask: {
              taxType: returnToClient.taxType || "vat",
              taskMongoId: savedTask._id,
              taskId: savedTask.taskId || "",
            },
          },
        });
        return;
      }
      navigate("/tasks/list");
    } catch (error) {
      const fallback = isEditMode ? "Unable to save task right now." : "Unable to create task right now.";
      const message = error?.response?.data?.errors?.[0]?.msg || error?.response?.data?.message || error?.message || fallback;
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div><div className="page-kicker">Task Workflow</div><h2 className="screen-title">{isEditMode ? "Edit Task" : "Add Task"}</h2></div>
      <div className="grid gap-3 md:grid-cols-3">{["Select Category", "Select Task Type", "Task Details"].map((label, i) => <Step key={label} n={i + 1} active={step >= i + 1} label={label} />)}</div>
      {step === 1 && <Card className="p-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{state.categories.map((cat) => <button key={cat.id} onClick={() => selectCategory(cat.id)} className="rounded-xl border border-[#e2e8f0] bg-white p-4 text-left transition hover:border-[#1e3a8a] hover:shadow"><div className="mb-3 h-2 w-10 rounded-full" style={{ background: cat.color }} /><div className="font-extrabold">{cat.name}</div><div className="mt-1 text-[12px] text-slate-500">{cat.taskTypes.length} task types</div></button>)}</div></Card>}
      {step === 2 && <Card className="p-4"><div className="mb-3 text-[14px] font-extrabold">Task types for {category.name}</div><div className="flex flex-wrap gap-2">{chips.map((chip) => <button key={chip} onClick={() => setType(chip)} className={`rounded-full px-3 py-2 text-[12px] font-extrabold ${type === chip ? "bg-[#1e3a8a] text-white" : "bg-slate-100 text-slate-600"}`}>{chip}</button>)}</div><div className="mt-5 flex gap-2"><Button variant="ghost" onClick={() => setStep(1)}>Back</Button><Button onClick={() => setStep(3)}>Continue</Button></div></Card>}
      {step === 3 && (
        <Card className="p-4">
          <div className="mb-4 rounded-xl border border-[#dbeafe] bg-blue-50 p-3">
            <div className="text-[11px] font-extrabold uppercase tracking-[.08em] text-[#1e3a8a]">Selected Task</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white px-2.5 py-1 text-[12px] font-extrabold text-[#1e3a8a]">{category?.name || "Category"}</span>
              <span className="text-[14px] font-extrabold text-slate-900">{type || "Select a task type"}</span>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Client*" field="taskClient">
              <ClientComboBox
                clients={state.clients}
                value={details.client}
                onChange={(id) => setDetails({ ...details, client: id })}
              />
            </Field>
            <Field label="Assign To" field="taskAssignedTo"><select className="input" value={details.assigned} onChange={(e) => setDetails({ ...details, assigned: e.target.value })}><option value="">Unassigned</option>{state.users.map((u) => <option key={u.id} value={u._id}>{u.name}</option>)}</select></Field>
            <Field label="Due Date*" field="taskDueDate"><input className="input" type="date" value={details.dueDate} onChange={(e) => handleRecurrenceChange({ dueDate: e.target.value })} /></Field>
            <Field label="Description / Notes" field="taskDescription"><textarea className="input textarea" value={details.description} onChange={(e) => setDetails({ ...details, description: e.target.value })} /></Field>
          </div>
          <div className="mt-4 space-y-3">
            <AttachmentUploadZone
              description={attachmentDescription}
              onDescriptionChange={setAttachmentDescription}
              onFiles={handleAttachmentFiles}
              isUploading={isUploadingAttachments || submitting}
            />
            <AttachmentList attachments={attachments} onDelete={removeAttachment} />
          </div>

          {/* ── Period section ─────────────────────────────────────────── */}
          {showPeriod && (
            <div className="mt-4 rounded-xl border border-[#e2e8f0] bg-slate-50/60 p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-[.08em] text-slate-500">Period</span>
                {details.client && selectedClient?.financialYearEnd && (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-[#1e3a8a]">
                    FYE: {selectedClient.financialYearEnd}
                  </span>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Financial Year" field="taskPeriodFY">
                  <select
                    className="input"
                    value={details.periodFY}
                    onChange={(e) => setDetails({ ...details, periodFY: e.target.value })}
                  >
                    <option value="">Select FY</option>
                    {fyOptions.map((fy) => (
                      <option key={fy} value={fy}>{fy}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Period" field="taskPeriodQuarter">
                  <select
                    className="input"
                    value={details.periodQuarter}
                    onChange={(e) => setDetails({ ...details, periodQuarter: e.target.value })}
                  >
                    <option value="">Select Period</option>
                    {quarterOptions.map((q) => (
                      <option key={q.value} value={q.value}>{q.value}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          )}
          {showRecurring && (
            <>
              <ToggleRow label="Recurring Task" checked={recurring} onChange={(val) => {
                setRecurring(val);
                if (val && !details.nextDue) {
                  const nextDue = calculateFrontendNextDue(
                    details.dueDate,
                    details.frequency,
                    details.dayOfWeek,
                    details.dateOfMonth,
                    details.monthOfYear
                  );
                  setDetails(prev => ({ ...prev, nextDue }));
                }
              }} />
              <div className={`smooth-panel overflow-hidden ${recurring ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}`}>
                <div className="mt-3 rounded-xl bg-slate-50 p-4 space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <Field label="Frequency" field="taskRecurringFrequency">
                      <select className="input" value={details.frequency} onChange={(e) => handleRecurrenceChange({ frequency: e.target.value })}>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="annual">Annually</option>
                      </select>
                    </Field>
                    <Field label="Next Due Date" field="taskNextDueDate">
                      <input className="input" type="date" value={details.nextDue} onChange={(e) => setDetails({ ...details, nextDue: e.target.value })} />
                    </Field>
                    <Field label="End Date" field="taskRecurringEndDate">
                      <input className="input" type="date" value={details.endDate} onChange={(e) => setDetails({ ...details, endDate: e.target.value })} />
                    </Field>
                  </div>

                  {/* Dynamic Frequency Settings Row */}
                  <div className="grid gap-3 md:grid-cols-3 border-t border-slate-200/60 pt-3">
                    {details.frequency === "weekly" && (
                      <Field label="Select Day" field="taskWeeklyDay">
                        <select className="input" value={details.dayOfWeek} onChange={(e) => handleRecurrenceChange({ dayOfWeek: e.target.value })}>
                          <option value="Sun">Sunday</option>
                          <option value="Mon">Monday</option>
                          <option value="Tue">Tuesday</option>
                          <option value="Wed">Wednesday</option>
                          <option value="Thu">Thursday</option>
                          <option value="Fri">Friday</option>
                          <option value="Sat">Saturday</option>
                        </select>
                      </Field>
                    )}

                    {(details.frequency === "monthly" || details.frequency === "quarterly") && (
                      <Field label="Select Date" field="taskDateOfMonth">
                        <select className="input" value={details.dateOfMonth} onChange={(e) => handleRecurrenceChange({ dateOfMonth: Number(e.target.value) })}>
                          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                            <option key={d} value={d}>Day {d}</option>
                          ))}
                        </select>
                      </Field>
                    )}

                    {details.frequency === "annual" && (
                      <>
                        <Field label="Select Month" field="taskMonthOfYear">
                          <select className="input" value={details.monthOfYear} onChange={(e) => handleRecurrenceChange({ monthOfYear: Number(e.target.value) })}>
                            <option value={1}>January</option>
                            <option value={2}>February</option>
                            <option value={3}>March</option>
                            <option value={4}>April</option>
                            <option value={5}>May</option>
                            <option value={6}>June</option>
                            <option value={7}>July</option>
                            <option value={8}>August</option>
                            <option value={9}>September</option>
                            <option value={10}>October</option>
                            <option value={11}>November</option>
                            <option value={12}>December</option>
                          </select>
                        </Field>
                        <Field label="Select Date" field="taskDateOfMonth">
                          <select className="input" value={details.dateOfMonth} onChange={(e) => handleRecurrenceChange({ dateOfMonth: Number(e.target.value) })}>
                            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                              <option key={d} value={d}>Day {d}</option>
                            ))}
                          </select>
                        </Field>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
          {showAwaitingFta && (
            <>
              <ToggleRow label="Awaiting FTA Response" checked={fta} onChange={setFta} />
              <div className={`smooth-panel overflow-hidden ${fta ? "max-h-20 opacity-100" : "max-h-0 opacity-0"}`}><div className="mt-3 rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-[12px] font-semibold text-yellow-800">This task will be routed to FTA Tracker when submitted.</div></div>
            </>
          )}
          <div className="mt-5 flex gap-2"><Button variant="ghost" onClick={() => setStep(2)}>Back</Button><Button onClick={submit} disabled={submitting}><Send size={16} />{submitting ? (isEditMode ? "Saving..." : "Submitting...") : (isEditMode ? "Save Task" : "Submit Task")}</Button></div>
        </Card>
      )}
    </div>
  );
}
function Step({ n, label, active }) { return <div className={`flex items-center gap-3 rounded-xl border p-3 ${active ? "border-[#1e3a8a] bg-white" : "border-[#e2e8f0] bg-white/60"}`}><div className={`grid h-7 w-7 place-items-center rounded-full text-[12px] font-black ${active ? "bg-[#1e3a8a] text-white" : "bg-slate-200 text-slate-500"}`}>{active ? <Check size={15} /> : n}</div><div className="font-extrabold">{label}</div></div>; }

function ClientComboBox({ clients, value, onChange }) {
  const [inputValue, setInputValue] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const selected = clients.find((c) => (c._id || c.id) === value);

  // Always filter by what the user has typed
  const filtered = clients.filter((c) =>
    !inputValue.trim() || c.name?.toLowerCase().includes(inputValue.toLowerCase())
  );

  // Sync input display: when closed and a client is selected, show its name
  // When open (actively searching), keep user's typed query as-is
  const displayValue = open ? inputValue : (selected?.name || inputValue);

  useEffect(() => {
    function onOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        // If user typed but didn't select, revert to empty or keep selected name
        setInputValue(selected?.name || "");
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [selected]);

  function handleFocus() {
    setInputValue(""); // clear so user can type a fresh search
    setOpen(true);
  }

  function handleChange(e) {
    setInputValue(e.target.value);
    setOpen(true);
  }

  function handleSelect(client) {
    onChange(client._id || client.id);
    setInputValue(client.name); // immediately show selected name in the box
    setOpen(false);
  }

  function handleClear(e) {
    e.stopPropagation();
    onChange("");
    setInputValue("");
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative flex items-center">
        <input
          id="taskClient"
          name="taskClient"
          className="input pr-14"
          type="text"
          autoComplete="off"
          placeholder="Search client…"
          value={displayValue}
          onFocus={handleFocus}
          onChange={handleChange}
        />
        <span className="pointer-events-none absolute right-2 flex items-center gap-1">
          {value && (
            <button
              type="button"
              className="pointer-events-auto text-slate-400 transition hover:text-slate-600"
              onMouseDown={handleClear}
              aria-label="Clear client"
            >
              <X size={13} />
            </button>
          )}
          <ChevronDown
            size={13}
            className={`pointer-events-none text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </span>
      </div>
      {open && (
        <ul className="absolute top-full left-0 z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-[#e2e8f0] bg-white shadow-lg custom-scrollbar">
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-[12px] text-slate-400">No clients found</li>
          ) : (
            filtered.map((c) => (
              <li
                key={c._id || c.id}
                onMouseDown={() => handleSelect(c)}
                className={`cursor-pointer px-4 py-2.5 text-[13px] transition-colors hover:bg-blue-50 hover:text-[#1e3a8a] ${
                  (c._id || c.id) === value
                    ? "bg-blue-50/70 font-extrabold text-[#1e3a8a]"
                    : "font-semibold text-slate-700"
                }`}
              >
                {c.name}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
function Field({ label, field, children }) {
  const control = isValidElement(children)
    ? cloneElement(children, {
      id: children.props.id || field,
      name: children.props.name || field,
    })
    : children;
  return <label htmlFor={field}><span className="field-label">{label}</span>{control}</label>;
}
function ToggleRow({ label, checked, onChange }) { return <div className="mt-4 flex items-center justify-between rounded-xl border border-[#e2e8f0] p-3"><span className="font-extrabold">{label}</span><Toggle checked={checked} onChange={onChange} /></div>; }

function AttachmentUploadZone({ description, onDescriptionChange, onFiles, isUploading }) {
  const inputId = "task-attachment-upload";
  return (
    <div
      className={`upload-zone transition hover:bg-slate-100 ${isUploading ? "pointer-events-none opacity-70" : ""}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onFiles(event.dataTransfer.files, description);
      }}
    >
      <UploadCloud className="mb-2 text-[#1e3a8a]" size={28} />
      <div className="text-[15px] font-extrabold text-slate-800">{isUploading ? "Uploading..." : "Upload attachments"}</div>
      <div className="mt-1 text-[12px] font-semibold text-slate-500">Choose one or more files. You can open selected files immediately.</div>
      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <Field label="Attachment Description" field="task-attachment-description">
          <input
            className="input"
            value={description}
            placeholder="Optional attachment note"
            onChange={(event) => onDescriptionChange(event.target.value)}
          />
        </Field>
        <label htmlFor={inputId} className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#1e3a8a] px-4 text-[14px] font-bold text-white transition hover:bg-[#1d4ed8]">
          <UploadCloud size={16} />
          {isUploading ? "Uploading..." : "Upload files"}
        </label>
      </div>
      <input
        id={inputId}
        name="taskAttachmentUpload"
        className="hidden"
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
        onChange={(event) => {
          onFiles(event.target.files, description);
          event.target.value = "";
        }}
      />
    </div>
  );
}

function AttachmentList({ attachments, onDelete }) {
  if (!attachments.length) {
    return <div className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-[12px] font-semibold text-slate-500">No attachments added yet.</div>;
  }
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      {attachments.map((attachment) => (
        <div key={attachment.id || attachment.name} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-bold text-slate-800">{attachment.name}</div>
            <div className="text-[11px] font-semibold text-slate-500">
              {[attachment.size, attachment.description, attachment.uploadedOn, attachment.uploadedBy].filter(Boolean).join(" • ") || (attachment.saved ? "Uploaded" : "Pending save")}
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" disabled={!attachment.url && !attachment.file} onClick={() => openAttachmentFile(attachment)}>Open</Button>
            <Button size="sm" variant="danger" onClick={() => onDelete(attachment)}>Delete</Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatFileSize(size) {
  if (!size) return "";
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2).replace(/\.?0+$/, "")} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function toPendingAttachment(file, description) {
  return {
    id: `${file.name}-${file.lastModified}-${file.size}`,
    name: file.name,
    size: formatFileSize(file.size),
    type: file.type || file.name.split(".").pop()?.toUpperCase() || "File",
    description,
    uploadedOn: "Pending save",
    uploadedBy: "You",
    file,
    saved: false,
  };
}

function mapAttachmentRows(items = []) {
  return items.map((attachment) => ({
    id: attachment._id,
    name: attachment.name,
    size: attachment.size,
    type: attachment.fileType,
    description: attachment.description || "",
    uploadedOn: attachment.uploadedAt?.slice?.(0, 10) || "",
    uploadedBy: attachment.uploadedBy?.name || "You",
    url: attachment.url,
    saved: true,
  }));
}

function openAttachmentFile(attachment) {
  if (attachment?.url) {
    window.open(attachment.url, "_blank", "noopener,noreferrer");
    return;
  }
  if (!attachment?.file) return;
  const objectUrl = URL.createObjectURL(attachment.file);
  window.open(objectUrl, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

// --- RECURRING TASK HIGH-PRECISION DATE CALCULATORS ---

function getNextWeeklyDate(baseDate, targetDayStr) {
  const dayMap = { "Sun": 0, "Mon": 1, "Tue": 2, "Wed": 3, "Thu": 4, "Fri": 5, "Sat": 6 };
  const targetDay = dayMap[targetDayStr];
  if (targetDay === undefined) return baseDate;

  const result = new Date(baseDate);
  for (let i = 1; i <= 7; i++) {
    result.setUTCDate(result.getUTCDate() + 1);
    if (result.getUTCDay() === targetDay) {
      return result;
    }
  }
  return result;
}

function getNextMonthlyDate(baseDate, targetDate) {
  const currentYear = baseDate.getUTCFullYear();
  const currentMonth = baseDate.getUTCMonth();
  let targetYear = currentYear;
  let targetMonth = currentMonth + 1;
  if (targetMonth > 11) {
    targetMonth = 0;
    targetYear += 1;
  }

  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();

  if (targetDate <= daysInTargetMonth) {
    return new Date(Date.UTC(targetYear, targetMonth, targetDate));
  } else {
    let nextMonth = targetMonth + 1;
    let nextYear = targetYear;
    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }
    return new Date(Date.UTC(nextYear, nextMonth, 1));
  }
}

function getNextQuarterlyDate(baseDate, targetDate) {
  const currentYear = baseDate.getUTCFullYear();
  const currentMonth = baseDate.getUTCMonth();
  let targetMonth = currentMonth + 3;
  let targetYear = currentYear;
  while (targetMonth > 11) {
    targetMonth -= 12;
    targetYear += 1;
  }

  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();

  if (targetDate <= daysInTargetMonth) {
    return new Date(Date.UTC(targetYear, targetMonth, targetDate));
  } else {
    let nextMonth = targetMonth + 1;
    let nextYear = targetYear;
    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }
    return new Date(Date.UTC(nextYear, nextMonth, 1));
  }
}

function getNextYearlyDate(baseDate, targetMonth, targetDate) {
  const targetMonth0 = targetMonth - 1;
  const currentYear = baseDate.getUTCFullYear();
  const targetYear = currentYear + 1;

  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth0 + 1, 0)).getUTCDate();

  if (targetDate <= daysInTargetMonth) {
    return new Date(Date.UTC(targetYear, targetMonth0, targetDate));
  } else {
    let nextMonth = targetMonth0 + 1;
    let nextYear = targetYear;
    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }
    return new Date(Date.UTC(nextYear, nextMonth, 1));
  }
}

function calculateFrontendNextDue(dueDateStr, frequency, dayOfWeek, dateOfMonth, monthOfYear) {
  if (!dueDateStr) return "";
  const baseDate = new Date(dueDateStr);
  if (isNaN(baseDate.getTime())) return "";

  let nextDate;
  switch (frequency) {
    case "weekly":
      nextDate = getNextWeeklyDate(baseDate, dayOfWeek || "Sun");
      break;
    case "monthly":
      nextDate = getNextMonthlyDate(baseDate, dateOfMonth || 1);
      break;
    case "quarterly":
      nextDate = getNextQuarterlyDate(baseDate, dateOfMonth || 1);
      break;
    case "annual":
      nextDate = getNextYearlyDate(baseDate, monthOfYear || 1, dateOfMonth || 1);
      break;
    default:
      nextDate = new Date(baseDate);
      nextDate.setUTCMonth(nextDate.getUTCMonth() + 1);
  }

  try {
    return nextDate.toISOString().slice(0, 10);
  } catch (e) {
    return "";
  }
}
