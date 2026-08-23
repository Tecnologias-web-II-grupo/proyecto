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
router.post('/pagos/banco/callback', c.bankCallback);
router.get('/me', requirePortalAuth, c.me);
router.put('/perfil', requirePortalAuth, upload, c.saveProfile);
router.put('/perfil/banco', requirePortalAuth, c.saveBankProfile);
router.get('/clientes', requirePortalAuth, c.listClients);
router.post('/ventas', requirePortalAuth, c.createSale);
router.put('/ventas/:id', requirePortalAuth, c.updateSale);
router.get('/ventas', requirePortalAuth, c.listSales);
router.get('/ventas/:id', requirePortalAuth, c.saleById);
router.post('/ventas/:id/pago/iniciar', requirePortalAuth, c.startPayment);
router.post('/ventas/:id/pago/confirmar', requirePortalAuth, c.confirmPayment);
router.post('/ventas/:id/reintentar', requirePortalAuth, c.retryPipeline);

module.exports = router;
