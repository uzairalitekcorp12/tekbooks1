import {Router} from 'express';
import {requireAuth} from '../middleware/auth.js';
import {Transaction,Invoice} from '../models/index.js';
const r=Router();r.use(requireAuth);
r.get('/',async(req,res)=>{const uid=req.user._id;const now=new Date(),monthStart=new Date(now.getFullYear(),now.getMonth(),1);const[totals,unpaid,monthly,cats,thisMonth,recentTransactions,recentInvoices]=await Promise.all([
Transaction.aggregate([{$match:{userId:uid}},{$group:{_id:'$type',total:{$sum:'$amount'}}}]),
Invoice.aggregate([{$match:{userId:uid,status:{$ne:'PAID'}}},{$group:{_id:null,total:{$sum:'$balance'},count:{$sum:1},overdue:{$sum:{$cond:[{$lt:['$dueDate',now]},1,0]}}}}]),
Transaction.aggregate([{$match:{userId:uid,date:{$gte:new Date(now.getFullYear(),now.getMonth()-5,1)}}},{$group:{_id:{y:{$year:'$date'},m:{$month:'$date'},type:'$type'},total:{$sum:'$amount'}}},{$sort:{'_id.y':1,'_id.m':1}}]),
Transaction.aggregate([{$match:{userId:uid,type:'EXPENSE'}},{$group:{_id:'$category',total:{$sum:'$amount'}}},{$sort:{total:-1}},{$limit:5}]),
Transaction.aggregate([{$match:{userId:uid,date:{$gte:monthStart}}},{$group:{_id:'$type',total:{$sum:'$amount'}}}]),
Transaction.find({userId:uid}).sort({date:-1,createdAt:-1}).limit(6).lean(),
Invoice.find({userId:uid}).sort({createdAt:-1}).limit(4).lean()
]);
const income=totals.find((x:any)=>x._id==='INCOME')?.total||0,expenses=totals.find((x:any)=>x._id==='EXPENSE')?.total||0;res.json({income,expenses,profit:income-expenses,cashPosition:income-expenses,unpaidInvoices:unpaid[0]?.total||0,unpaidCount:unpaid[0]?.count||0,overdueCount:unpaid[0]?.overdue||0,monthlyTrend:monthly,topExpenseCategories:cats.map((x:any)=>({category:x._id,total:x.total})),thisMonth:{income:thisMonth.find((x:any)=>x._id==='INCOME')?.total||0,expenses:thisMonth.find((x:any)=>x._id==='EXPENSE')?.total||0},recentTransactions,recentInvoices});});
export default r;
