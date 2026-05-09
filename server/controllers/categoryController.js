const Category = require("../models/Category");

exports.listCategories = async (req, res, next) => {
  try { res.json(await Category.find({ isActive: true }).sort({ createdAt: 1 })); } catch (error) { next(error); }
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
    category.taskTypes.push({ name: req.body.name, isActive: true });
    await category.save();
    res.status(201).json(category);
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
