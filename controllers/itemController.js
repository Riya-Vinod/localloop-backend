const Item = require('../models/Item');
const User = require('../models/User');

// POST /api/items
exports.createItem = async (req, res) => {
  try {
    const { title, description, category, location, images, condition, estimatedValue, tags } = req.body;

    // Calculate carbon footprint estimate based on category
    const carbonEstimates = {
      Electronics: 25, Tools: 15, Sports: 10, Books: 5, Kitchen: 8,
      Garden: 12, Furniture: 30, Clothing: 8, Toys: 6, Music: 10,
      Photography: 20, Camping: 15, Automotive: 35, Office: 12, Other: 10
    };

    const item = await Item.create({
      title,
      description,
      category,
      owner: req.user._id,
      location: location || req.user.location,
      images: images || [],
      condition: condition || 'Good',
      estimatedValue: estimatedValue || 0,
      carbonFootprint: carbonEstimates[category] || 10,
      tags: tags || []
    });

    await item.populate('owner', 'name avatar trustScore');

    res.status(201).json({ success: true, item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/items
exports.getItems = async (req, res) => {
  try {
    const { category, status, search, page = 1, limit = 12 } = req.query;
    const query = {};

    if (category) query.category = category;
    if (status) query.status = status;
    else query.status = 'Available';

    if (search) {
      query.$text = { $search: search };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const items = await Item.find(query)
      .populate('owner', 'name avatar trustScore location')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Item.countDocuments(query);

    res.json({
      success: true,
      items,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/items/nearby
exports.getNearbyItems = async (req, res) => {
  try {
    const { lng, lat, radius = 10, category, page = 1, limit = 20 } = req.query;

    if (!lng || !lat) {
      return res.status(400).json({ success: false, message: 'Longitude and latitude are required' });
    }

    const query = {
      location: {
        $nearSphere: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: parseFloat(radius) * 1000 // Convert km to meters
        }
      },
      status: 'Available'
    };

    if (category) query.category = category;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const items = await Item.find(query)
      .populate('owner', 'name avatar trustScore')
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Item.countDocuments(query);

    res.json({
      success: true,
      items,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/items/:id
exports.getItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id)
      .populate('owner', 'name avatar trustScore bio location totalLendings successfulTransactions');

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    res.json({ success: true, item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/items/:id
exports.updateItem = async (req, res) => {
  try {
    let item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    if (item.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this item' });
    }

    item = await Item.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    }).populate('owner', 'name avatar trustScore');

    res.json({ success: true, item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/items/:id
exports.deleteItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    if (item.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this item' });
    }

    await Item.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/items/user/my-items
exports.getMyItems = async (req, res) => {
  try {
    const items = await Item.find({ owner: req.user._id })
      .populate('owner', 'name avatar trustScore')
      .sort({ createdAt: -1 });

    res.json({ success: true, items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
