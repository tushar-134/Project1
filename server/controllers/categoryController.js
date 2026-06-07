const Category = require("../models/Category");

exports.listCategories = async (req, res, next) => {
  try {
    const includeInactive = req.query.includeInactive === "true" && req.user?.role === "admin";
    const query = includeInactive ? {} : { isActive: true };
    res.json(await Category.find(query).sort({ createdAt: 1 }));
  } catch (error) { next(error); }
};
exports.createCategory = async (req, res, next) => {
  try { res.status(201).json(await Category.create(req.body)); } catch (error) { next(error); }
};
exports.updateCategory = async (req, res, next) => {
  try { res.json(await Category.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (error) { next(error); }
};
exports.deleteCategory = async (req, res, next) => {
  try { res.json(await Category.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true })); } catch (error) { next(error); }
};
exports.addTaskType = async (req, res, next) => {
  try {
    // Task types are embedded subdocuments because the admin UI edits them inline inside one category payload.
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: "Category not found" });
    // Accept visibility toggle fields from the frontend modal; new task types send explicit false values.
    const { name, showFY = false, showQuarter = false, showRecurring = false, showAwaitingFta = false } = req.body;
    category.taskTypes.push({ name, isActive: true, showFY, showQuarter, showRecurring, showAwaitingFta });
    await category.save();
    res.status(201).json(category);
  } catch (error) { next(error); }
};
exports.updateTaskType = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: "Category not found" });
    const taskType = category.taskTypes.id(req.params.typeId);
    if (!taskType) return res.status(404).json({ message: "Task type not found" });
    // Allow updating the name and all three visibility toggles from the edit modal.
    const { name, showFY, showQuarter, showRecurring, showAwaitingFta } = req.body;
    if (name !== undefined) taskType.name = name;
    if (showFY !== undefined) taskType.showFY = showFY;
    if (showQuarter !== undefined) taskType.showQuarter = showQuarter;
    if (showRecurring !== undefined) taskType.showRecurring = showRecurring;
    if (showAwaitingFta !== undefined) taskType.showAwaitingFta = showAwaitingFta;
    await category.save();
    res.json(category);
  } catch (error) { next(error); }
};
exports.deleteTaskType = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: "Category not found" });
    category.taskTypes.pull(req.params.typeId);
    await category.save();
    res.json(category);
  } catch (error) { next(error); }
};
exports.updateTaskTypeStatus = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: "Category not found" });
    const taskType = category.taskTypes.id(req.params.typeId);
    if (!taskType) return res.status(404).json({ message: "Task type not found" });
    taskType.isActive = req.body.isActive;
    await category.save();
    res.json(category);
  } catch (error) { next(error); }
};
