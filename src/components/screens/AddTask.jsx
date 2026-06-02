import { cloneElement, isValidElement, useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Check, Send, UploadCloud } from "lucide-react";
import toast from "react-hot-toast";
import { useApp } from "../../context/AppContext.jsx";
import { useClients } from "../../hooks/useClients";
import { useUsers } from "../../hooks/useUsers";
import { useTasks } from "../../hooks/useTasks";
import { categoryService } from "../../services/categoryService";
import { mapCategory } from "../../utils/adapterUtils";
import { getFYOptions, getQuarters, getCurrentFYAndQuarter, getQuarterFromVatFrequency } from "../../utils/periodUtils";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import ClientComboBox from "../ui/ClientComboBox.jsx";
import Toggle from "../ui/Toggle.jsx";
import UnsavedChangesGuard from "../ui/UnsavedChangesGuard.jsx";
import CustomSelect from "../ui/CustomSelect.jsx";

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

  const [savedStatus, setSavedStatus] = useState("not_started");
  const [submitting, setSubmitting] = useState(false);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [attachmentDescription, setAttachmentDescription] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [details, setDetailsRaw] = useState({
    client: prefillTask?.clientId || "",
    assigned: "",
    dueDate: "",
    periodFY: "",
    periodQuarter: "",
    description: prefillTask?.description || "",
    frequency: "monthly",
    daysBeforeDue: 15,
    nextDue: "",
    endDate: ""
  });
  const chips = useMemo(() => category?.taskTypes || [], [category]);

  // Derive field-visibility config from the selected task type's saved toggles.
  // Falls back to true so existing task types (which have DB default true) keep all fields visible.
  const selectedRawType = useMemo(() => {
    const raw = category?.rawTaskTypes || [];
    return raw.find((t) => t.name === type) || null;
  }, [category, type]);
  const showFY = selectedRawType ? (selectedRawType.showFY ?? selectedRawType.showPeriod ?? true) : true;
  const showQuarter = selectedRawType ? (selectedRawType.showQuarter ?? selectedRawType.showPeriod ?? true) : true;
  const showRecurring = selectedRawType ? (selectedRawType.showRecurring !== false) : true;

  const setDetails = (update) => {
    setIsDirty(true);
    setDetailsRaw(update);
  };


  // Derive FY + Quarter options from the selected client's financialYearEnd.
  const selectedClient = useMemo(
    () => state.clients.find((c) => (c._id || c.id) === details.client) || null,
    [state.clients, details.client]
  );
  const clientFYE = selectedClient?.financialYearEnd || "Jan - Dec";
  const vatFilingFrequency = selectedClient?.vatDetails?.filingFrequency || "";
  const fyOptions = useMemo(() => getFYOptions(clientFYE), [clientFYE]);
  // For VAT category, build quarter options from the client's VAT filing frequency so the
  // auto-populated value (from getQuarterFromVatFrequency) always matches an available option.
  // For all other categories fall back to the FYE-based quarters.
  const quarterOptions = useMemo(() => {
    if (categoryName === "VAT" && vatFilingFrequency) {
      const parts = vatFilingFrequency.split("||").map((p) => p.trim()).filter(Boolean);
      if (parts.length) {
        return parts.map((p, i) => ({ value: p, startMonth: 0, endMonth: 0, quarterIndex: i }));
      }
    }
    return getQuarters(clientFYE);
  }, [clientFYE, categoryName, vatFilingFrequency]);
  useEffect(() => {
    // Fetch users and categories on mount — these are needed from Step 1 onwards.
    fetchUsers().catch(() => { });
    categoryService.list().then((data) => dispatch({ type: "SET_RESOURCE", resource: "categories", payload: data.map(mapCategory) })).catch(() => { });
  }, []);

  // Fetch clients only when Step 3 is active (or immediately when edit mode skips to Step 3).
  // The ClientComboBox handles its own server-side search when opened, so the initial fetch
  // is only needed to populate selectedClient for FY/Quarter auto-computation.
  useEffect(() => {
    if (step < 3) return;
    fetchClients({ limit: 10 }).catch(() => { });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Auto-populate FY and Quarter once a client is selected (new tasks only).
  // Clears the fields when client is deselected; re-computes when client changes or category changes.
  useEffect(() => {
    if (isEditMode) return;
    if (!details.client) {
      setDetailsRaw((prev) => ({ ...prev, periodFY: "", periodQuarter: "" }));
      return;
    }
    
    let fy = "";
    let quarter = "";
    const fye = clientFYE;
    
    // Use raw Category Name for logic (categoryId may be generic mapped id e.g. "vat")
    if (categoryName === "VAT") {
      const { fy: computedFy } = getCurrentFYAndQuarter(fye);
      fy = computedFy;
      const vatFreq = selectedClient?.vatDetails?.filingFrequency || "";
      quarter = getQuarterFromVatFrequency(vatFreq, new Date());
    } else if (categoryName === "CT" || categoryName === "Corporate Tax") {
      const ctFye = selectedClient?.ctDetails?.financialYearEnd || fye;
      const { fy: computedFy } = getCurrentFYAndQuarter(ctFye);
      fy = computedFy;
      quarter = ""; // CT only uses FY
    } else {
      const current = getCurrentFYAndQuarter(fye);
      fy = current.fy;
      quarter = current.quarter;
    }
    
    setDetailsRaw((prev) => ({ ...prev, periodFY: fy, periodQuarter: quarter }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details.client, clientFYE, isEditMode, categoryName]);
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

      // Handle both mapped shape (apiStatus) and raw API shape (status enum)
      setSavedStatus(task.apiStatus || task.status || "not_started");
      setDetailsRaw({
        // Handle both mapped shape (clientId) and raw API shape (client._id)
        client: task.client?._id || task.clientId || (typeof task.client === "string" ? "" : task.client) || "",
        // Handle both mapped shape (assignedId) and raw API shape (assignedTo._id)
        assigned: task.assignedTo?._id || task.assignedId || (typeof task.assignedTo === "string" ? task.assignedTo : "") || "",
        dueDate: task.dueDate?.slice?.(0, 10) || "",
        periodFY: task.periodFY || "",
        periodQuarter: task.periodQuarter || "",
        description: task.description || "",
        frequency: task.recurringConfig?.frequency || "monthly",
        daysBeforeDue: task.recurringConfig?.daysBeforeDue || 15,
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
    setDetailsRaw((current) => ({
      ...current,
      client: prefillTask.clientId || current.client,
      description: prefillTask.description || current.description,
    }));
  }, [isEditMode, prefillTask]);

  const initialLocationKey = useRef(location.key);
  useEffect(() => {
    if (location.key === initialLocationKey.current) return;
    
    if (!isEditMode && !prefillTask) {
      if (isDirty) {
        toast.error("Task not saved, please save first.");
      } else {
        setStep(1);
        setCategoryId("vat");
        setCategoryName("VAT");
        setDetailsRaw({
          client: "",
          assigned: "",
          dueDate: "",
          periodFY: "",
          periodQuarter: "",
          description: "",
          frequency: "monthly",
          daysBeforeDue: 15,
          nextDue: "",
          endDate: ""
        });
        setRecurring(false);
        setAttachments([]);
        setAttachmentDescription("");
        setIsDirty(false);
      }
    }
    initialLocationKey.current = location.key;
  }, [location.key, isEditMode, prefillTask, isDirty]);

  useEffect(() => {
    if (!state.categories.length || !categoryName) return;
    const resolved = state.categories.find((cat) => cat.id === categoryId)
      || state.categories.find((cat) => cat.name === categoryName);
    if (resolved && resolved.id !== categoryId) setCategoryId(resolved.id);
  }, [state.categories, categoryId, categoryName]);

  const handleRecurrenceChange = (updatedFields) => {
    const nextDetails = { ...details, ...updatedFields };
    const nextDue = calculateFrontendNextDue(nextDetails.dueDate, nextDetails.frequency);
    setDetails({ ...nextDetails, nextDue });
  };

  function selectCategory(id) {
    const next = state.categories.find((cat) => cat.id === id);
    setCategoryId(id);
    setCategoryName(next?.name || categoryName);
    setType(next.taskTypes[0] || "");
    setStep(2);
  }

  function resetForm() {
    setStep(1);
    setCategoryId("");
    setCategoryName("");
    setType("");
    setRecurring(false);
    setDetailsRaw({
      client: "",
      assigned: "",
      dueDate: "",
      periodFY: "",
      periodQuarter: "",
      description: "",
      frequency: "monthly",
      daysBeforeDue: 15,
      nextDue: "",
      endDate: "",
    });
    setAttachments([]);
    setAttachmentDescription("");
    setIsDirty(false);
  }

  async function handleAttachmentFiles(files, description = "") {
    const selected = Array.from(files || []);
    if (!selected.length) return;
    const note = String(description || "").trim();

    if (!note) {
      toast.error("Attachment description is required before uploading.");
      return;
    }

    if (!id) {
      setAttachments((current) => [
        ...current,
        ...selected.map((file) => toPendingAttachment(file, note)),
      ]);
      setIsDirty(true);
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
      setIsDirty(true);
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
      const payload = {
        category: resolvedCategory.name,
        taskType: type,
        client: details.client,
        assignedTo: details.assigned || undefined,
        dueDate: details.dueDate,
        // Structured period fields — send only when their respective toggle is visible.
        periodFY: showFY ? (details.periodFY || undefined) : undefined,
        periodQuarter: showQuarter ? (details.periodQuarter || undefined) : undefined,
        description: details.description,
        isRecurring: effectiveRecurring,
        recurringConfig: effectiveRecurring ? {
          frequency: details.frequency,
          daysBeforeDue: details.daysBeforeDue,
          nextDueDate: details.nextDue,
          endDate: details.endDate || undefined
        } : undefined,
        isAwaitingFta: false,
        status: isEditMode ? savedStatus : "not_started",
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
      setIsDirty(false); // Reset dirty state before navigation
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
      <UnsavedChangesGuard isDirty={step === 3 && isDirty} />
      <div className="flex items-center justify-between gap-3">
        <div className="grid flex-1 gap-3 md:grid-cols-3">
          {["Select Category", "Select Task Type", "Task Details"].map((label, i) => (
            <Step
              key={label}
              n={i + 1}
              active={step >= i + 1}
              label={label}
              onClick={() => {
                const target = i + 1;
                // Only allow going back (not forward skipping);
                // forward navigation happens via category click / Continue button.
                if (target < step) setStep(target);
              }}
            />
          ))}
        </div>
        {!isEditMode && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetForm}
            title="Clear all selections and start fresh"
          >
            ↺ Start Over
          </Button>
        )}
      </div>
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
            <Field label="Assign To" field="taskAssignedTo">
              <CustomSelect
                value={details.assigned}
                onChange={(val) => setDetails({ ...details, assigned: val })}
                options={[
                  { value: "", label: "Unassigned" },
                  ...state.users.map((u) => ({ value: u._id, label: u.name }))
                ]}
              />
            </Field>
            <Field label="Due Date*" field="taskDueDate"><input className="input" type="date" value={details.dueDate} onChange={(e) => handleRecurrenceChange({ dueDate: e.target.value })} /></Field>
            {showFY && (
              <Field 
                label={
                  <span className="flex items-center gap-2">
                    <span>Financial Year</span>
                    {details.client && selectedClient?.financialYearEnd && (
                      <span 
                        className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-[#1e3a8a]"
                        style={{ textTransform: "none", letterSpacing: "normal" }}
                      >
                        FYE: {selectedClient.financialYearEnd}
                      </span>
                    )}
                  </span>
                } 
                field="taskPeriodFY"
              >
                <CustomSelect
                  value={details.periodFY}
                  onChange={(val) => setDetails({ ...details, periodFY: val })}
                  options={[
                    { value: "", label: "Select FY" },
                    ...fyOptions.map((fy) => ({ value: fy, label: fy }))
                  ]}
                />
              </Field>
            )}
            {showQuarter && (
              <Field label="Quarter" field="taskPeriodQuarter">
                <CustomSelect
                  value={details.periodQuarter}
                  onChange={(val) => setDetails({ ...details, periodQuarter: val })}
                  options={[
                    { value: "", label: "Select Quarter" },
                    ...quarterOptions.map((q) => ({ value: q.value, label: q.value }))
                  ]}
                />
              </Field>
            )}
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
          {showRecurring && (
            <>
              <ToggleRow label="Recurring Task" checked={recurring} onChange={(val) => {
                setRecurring(val);
                if (val && !details.nextDue) {
                  const nextDue = calculateFrontendNextDue(
                    details.dueDate,
                    details.frequency
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
                    <Field label="Days to create before Due date" field="taskDaysBeforeDue">
                      <input 
                        className="input" 
                        type="number" 
                        min="1" 
                        max="99" 
                        value={details.daysBeforeDue} 
                        onChange={(e) => handleRecurrenceChange({ daysBeforeDue: Number(e.target.value) })} 
                      />
                    </Field>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="mt-5 flex gap-2"><Button variant="ghost" onClick={() => {
            if (returnToClient?.clientId) {
              navigate(`/clients/edit/${returnToClient.clientId}`, {
                state: { activeTab: Number(returnToClient.activeTab) || 3 },
              });
              return;
            }
            setStep(2);
          }}>Back</Button><Button onClick={submit} disabled={submitting}><Send size={16} />{submitting ? (isEditMode ? "Saving..." : "Submitting...") : (isEditMode ? "Save Task" : "Submit Task")}</Button></div>
        </Card>
      )}
    </div>
  );
}
function Step({ n, label, active, onClick }) { 
  return (
    <button 
      type="button" 
      onClick={onClick} 
      className={`w-full text-left flex items-center gap-3 rounded-xl border p-3 transition-colors hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 ${active ? "border-[#1e3a8a] bg-white" : "border-[#e2e8f0] bg-white/60 hover:bg-white cursor-pointer"}`}
    >
      <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-black transition-colors ${active ? "bg-[#1e3a8a] text-white" : "bg-slate-200 text-slate-500"}`}>
        {active ? <Check size={15} /> : n}
      </div>
      <div className="font-extrabold truncate">{label}</div>
    </button>
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
        <Field label="Attachment Description*" field="task-attachment-description">
          <input
            className="input"
            value={description}
            placeholder="What is this attachment for?"
            onChange={(event) => onDescriptionChange(event.target.value)}
          />
        </Field>
        <label 
          htmlFor={description.trim() ? inputId : undefined}
          onClick={(e) => {
            if (!description.trim()) {
              e.preventDefault();
              toast.error("Please enter an attachment description first.");
            }
          }}
          className={`inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-[14px] font-bold text-white transition ${!description.trim() || isUploading ? "bg-slate-300 pointer-events-none" : "bg-[#1e3a8a] hover:bg-[#1d4ed8]"}`}
        >
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

function calculateFrontendNextDue(dueDateStr, frequency) {
  if (!dueDateStr) return "";
  const baseDate = new Date(dueDateStr);
  if (isNaN(baseDate.getTime())) return "";

  const nextDate = new Date(baseDate);
  switch (frequency) {
    case "weekly":
      nextDate.setUTCDate(nextDate.getUTCDate() + 7);
      break;
    case "monthly":
      nextDate.setUTCMonth(nextDate.getUTCMonth() + 1);
      break;
    case "quarterly":
      nextDate.setUTCMonth(nextDate.getUTCMonth() + 3);
      break;
    case "semi_annual":
      nextDate.setUTCMonth(nextDate.getUTCMonth() + 6);
      break;
    case "annual":
      nextDate.setUTCFullYear(nextDate.getUTCFullYear() + 1);
      break;
    default:
      nextDate.setUTCMonth(nextDate.getUTCMonth() + 1);
  }

  try {
    return nextDate.toISOString().slice(0, 10);
  } catch (e) {
    return "";
  }
}
