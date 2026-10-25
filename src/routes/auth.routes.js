const express=require('express')
const authController=require('../controllers/auth.controller')
const authMiddleware=require('../middleware/auth.middleware')
const router=express.Router()


router.post('/register',authController.userRegistraionController)
router.post('/login',authController.userLoginController)
router.post('/logout',authController.userLogOutController)

router.get('/profile',authMiddleware.authMiddleware,authController.getProfile)

module.exports=router