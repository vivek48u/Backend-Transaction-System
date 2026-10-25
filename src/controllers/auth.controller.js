const userModel = require('../models/user.model')
const emailService = require('../services/email.services')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const blackListModel=require('../models/balcklist.model')

async function userRegistraionController(req, res) {
  const { email, name, password } = req.body

  const isEmailexits = await userModel.findOne({
    email: email
  })

  if (isEmailexits) {
    return res.status(401).json({
      message: "User Already Exits with email!!!",
      status: "failed"
    })
  }

  const user = await userModel.create({
    email, name, password
  })

  console.log("Created User ID:", user._id);
  console.log("Database Name:", userModel.db.name);
  console.log("Collection Name:", userModel.collection.name);

  const checkUser = await userModel.findById(user._id);

  console.log("User immediately after creation:", checkUser);

  const token = jwt.sign({
    userId: user._id
  }, process.env.JWTSECRET_KEY)



  res.cookie('token', token)

  res.status(201).json({
    user: {
      user: user._id,
      email: user.email,
      name: user.name,
      password: user.password,
    }
  })

  await emailService.sendRegisterEmail(user.email, user.name)
}

async function userLoginController(req, res) {
  const { email, password } = req.body

  const user = await userModel.findOne({
    email
  }).select('+password')

  if (!user) {
    return res.status(401).json({
      message: "Invalid Credential"
    })
  }

  const isPasswordisValid = await user.comparePassword(password)

  if (!isPasswordisValid) {
    return res.status(401).json({
      message: "invalid credential"
    })
  }

  const token = jwt.sign({
    userId: user.id,
  }, process.env.JWTSECRET_KEY)

  res.cookie('token', token)

  res.status(200).json({
    message: "User Login Succefully.....!!!!",
    user: {
      id: user._id,
      email: user.email,
      password: user.password,
      token
    }

  })
}

async function userLogOutController(req,res){
 const token = req.cookies.token || req.headers.authorization?.split(' ')[1]

  if(!token){
    return res.status(200).json({
        message:"User Logout Sucessfully"
    })
  }

  res.cookie('token','')

  await blackListModel.create({
    token:token
  })

  res.status(200).json({
    message:'User Logout Succesfully'
  })
}

async function getProfile(req,res){
    const profile=await userModel.findById(req.user._id).select("-password");


     if (!profile) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.status(200).json({
      profile
    })

}
module.exports = { userRegistraionController, userLoginController, userLogOutController,getProfile }