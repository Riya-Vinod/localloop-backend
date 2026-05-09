const express = require('express');
const router = express.Router();
const {
  createItem, getItems, getNearbyItems, getItem,
  updateItem, deleteItem, getMyItems
} = require('../controllers/itemController');
const { protect } = require('../middleware/auth');

router.get('/nearby', protect, getNearbyItems);
router.get('/my-items', protect, getMyItems);
router.route('/')
  .get(getItems)
  .post(protect, createItem);
router.route('/:id')
  .get(getItem)
  .put(protect, updateItem)
  .delete(protect, deleteItem);

module.exports = router;
