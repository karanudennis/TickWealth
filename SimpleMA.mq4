//+------------------------------------------------------------------+
//| TickWealth SimpleMA (MT4). Educational EMA-cross EA. One trade   |
//| at a time, fixed SL/TP, risk-based lots. No Martingale, grid,    |
//| hedging or scalping. DEMO ONLY. Not an edge; it can lose money.  |
//+------------------------------------------------------------------+
#property strict
extern int    FastPeriod=20;  extern int SlowPeriod=50;
extern double StopLossPips=30; extern double TakeProfitPips=60;
extern double RiskPercent=1.0; extern int Magic=550101;
datetime lastBar=0;
double Pip(){ return (Digits==3||Digits==5)?Point*10:Point; }
double Lots(double slPips){
  double tv=MarketInfo(Symbol(),MODE_TICKVALUE), ts=MarketInfo(Symbol(),MODE_TICKSIZE); if(ts<=0||tv<=0) return 0;
  double perLot=slPips*Pip()/ts*tv, l=AccountEquity()*RiskPercent/100.0/perLot;
  double st=MarketInfo(Symbol(),MODE_LOTSTEP), mn=MarketInfo(Symbol(),MODE_MINLOT), mx=MarketInfo(Symbol(),MODE_MAXLOT);
  l=MathFloor(l/st)*st; return MathMax(mn,MathMin(mx,l)); }
bool HasPos(){ for(int i=OrdersTotal()-1;i>=0;i--){ if(OrderSelect(i,SELECT_BY_POS,MODE_TRADES) && OrderSymbol()==Symbol() && OrderMagicNumber()==Magic) return true; } return false; }
void OnTick(){
  if(Time[0]==lastBar) return; lastBar=Time[0];                                        // act once per new bar
  double f1=iMA(NULL,0,FastPeriod,0,MODE_EMA,PRICE_CLOSE,1), f2=iMA(NULL,0,FastPeriod,0,MODE_EMA,PRICE_CLOSE,2);
  double s1=iMA(NULL,0,SlowPeriod,0,MODE_EMA,PRICE_CLOSE,1), s2=iMA(NULL,0,SlowPeriod,0,MODE_EMA,PRICE_CLOSE,2);
  bool up=f2<=s2&&f1>s1, dn=f2>=s2&&f1<s1; if(HasPos()||(!up&&!dn)) return;
  double lots=Lots(StopLossPips); if(lots<=0) return; double sl=StopLossPips*Pip(), tp=TakeProfitPips*Pip();
  if(up) OrderSend(Symbol(),OP_BUY,lots,Ask,10,NormalizeDouble(Ask-sl,Digits),NormalizeDouble(Ask+tp,Digits),"SimpleMA",Magic,0,clrGreen);
  else   OrderSend(Symbol(),OP_SELL,lots,Bid,10,NormalizeDouble(Bid+sl,Digits),NormalizeDouble(Bid-tp,Digits),"SimpleMA",Magic,0,clrRed); }
