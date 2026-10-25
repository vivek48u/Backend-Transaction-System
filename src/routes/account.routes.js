const express=require('express')
const authMiddleware=require('../middleware/auth.middleware')
const accountController=require('../controllers/account.controller')

const router=express.Router()


router.post('/',authMiddleware.authMiddleware,accountController.createAccountController)

// get all accounts of logged in user

router.get('/',authMiddleware.authMiddleware,accountController.getUserAccountController)

// GET /api/accounts/balance/:accountId

router.get('/primary/balance',authMiddleware.authMiddleware,accountController.getAccountBalanceController)

router.patch("/:accountId/primary", authMiddleware.authMiddleware, accountController.setPrimary);
module.exports=router;