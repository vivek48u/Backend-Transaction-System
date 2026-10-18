require("dotenv").config();
const express=require('express');
const cookieparser=require('cookie-parser')
const authRouter=require('./routes/auth.routes')
const accountRouter=require('./routes/account.routes')
const transactionRouter=require('./routes/transction.routes')

const app=express();

app.use(express.json());
app.use(cookieparser());
app.use('/api/auth/',authRouter)
app.use('/api/account/',accountRouter)
app.use('/api/transaction/',transactionRouter)


app.get("/",(req,res)=>{
   res.send('Server are running Succesfully')
})


module.exports=app;
