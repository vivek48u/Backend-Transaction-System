const express=require('express')
const authController=require('../controllers/auth.controller')
const router=express.Router()

router.post('/register',authController.userRegistraionController)
router.post('/login',authController.userLoginController)
router.post('/logout',authController.userLogOutController)

module.exports=router