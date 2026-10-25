const express=require('express')
const authMiddleware=require('../middleware/auth.middleware')
const transactionController=require('../controllers/transaction.controller')


const router=express.Router()
//-- POST /api/transaction/
//-- Create new transaction
router.post('/',authMiddleware.authMiddleware,transactionController.createTransaction)

/**--Post/api/transaction/system/intial-funds **/
/**
 * - create intial funds transaction from system user
 */

router.post('/system/intial-funds',authMiddleware.authSystemUserMiddleware,transactionController.createIntialFundsTransaction)


router.get('/stats', authMiddleware.authMiddleware, transactionController.getStats)
router.get('/entries',authMiddleware.authMiddleware,transactionController.getLedgerEntries)
router.get('/history', authMiddleware.authMiddleware, transactionController.getHistory)

module.exports=router