const express = require('express');
const multer = require('multer');
const { requirePortalAuth } = require('../portal/auth');
const c = require('../portal/controller');

const router = express.Router();
const allowed = new Set(['image/png','image/jpeg','image/webp']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024, files: 2 },
  fileFilter: (req,file,cb) => allowed.has(String(file.mimetype||'').toLowerCase()) ? cb(null,true) : cb(new Error('El logo debe ser PNG, JPG o WEBP.'))
}).fields([{name:'logo',maxCount:1},{name:'logoBlanco',maxCount:1}]);

router.get('/config', c.config);
router.post('/auth/register', c.register);
router.post('/auth/login', c.login);
router.get('/me', requirePortalAuth, c.me);
router.put('/perfil', requirePortalAuth, upload, c.saveProfile);
router.put('/cuenta/contrasena', requirePortalAuth, c.changePassword);
router.delete('/cuenta', requirePortalAuth, c.deleteAccount);
router.get('/facturas', requirePortalAuth, c.listMyInvoices);
router.post('/integracion/api-key/rotar', requirePortalAuth, c.rotateApiKey);

module.exports = router;
