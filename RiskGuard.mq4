//+------------------------------------------------------------------+
//| TickWealth RiskGuard (MT4). Opens NO trades. Daily loss limit,   |
//| max drawdown, max open positions, margin warning. Demo first.    |
//+------------------------------------------------------------------+
#property strict
extern double MaxDailyLossPercent = 3.0;
extern double MaxDrawdownPercent  = 10.0;
extern int    MaxOpenPositions    = 3;
extern double MinMarginLevel      = 150.0;
bool halted=false; int lastDay=-1; double dayEq=0, peakEq=0; datetime lastWarn=0;
int Today(){ return Year()*1000+DayOfYear(); }
int OnInit(){
  double eq=AccountEquity();
  if(GlobalVariableCheck("RG_day") && (int)GlobalVariableGet("RG_day")==Today()) dayEq=GlobalVariableGet("RG_eq"); else { dayEq=eq; GlobalVariableSet("RG_eq",dayEq); GlobalVariableSet("RG_day",Today()); }
  peakEq=GlobalVariableCheck("RG_peak")?MathMax(GlobalVariableGet("RG_peak"),eq):eq;
  lastDay=Today(); EventSetTimer(1); return INIT_SUCCEEDED; }
void OnDeinit(const int r){ EventKillTimer(); Comment(""); }
int CountOpen(){ int n=0; for(int i=OrdersTotal()-1;i>=0;i--) if(OrderSelect(i,SELECT_BY_POS,MODE_TRADES) && OrderType()<=OP_SELL) n++; return n; }
void CloseOne(int i){
  if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES)) return;
  if(OrderType()==OP_BUY) OrderClose(OrderTicket(),OrderLots(),MarketInfo(OrderSymbol(),MODE_BID),20,clrNONE);
  else if(OrderType()==OP_SELL) OrderClose(OrderTicket(),OrderLots(),MarketInfo(OrderSymbol(),MODE_ASK),20,clrNONE);
  else OrderDelete(OrderTicket()); }
void CloseAll(){ for(int i=OrdersTotal()-1;i>=0;i--) CloseOne(i); }
void OnTimer(){
  if(Today()!=lastDay){ lastDay=Today(); dayEq=AccountEquity(); halted=false; GlobalVariableSet("RG_eq",dayEq); GlobalVariableSet("RG_day",lastDay); }
  double eq=AccountEquity(); if(eq>peakEq){ peakEq=eq; GlobalVariableSet("RG_peak",peakEq); }
  double dl=dayEq>0?(dayEq-eq)/dayEq*100.0:0, dd=peakEq>0?(peakEq-eq)/peakEq*100.0:0;
  if(!halted && (dl>=MaxDailyLossPercent || dd>=MaxDrawdownPercent)){ halted=true; CloseAll(); Alert("RiskGuard: limit reached. Positions closed, trading halted."); }
  if(halted) CloseAll();
  else { int guard=50; while(CountOpen()>MaxOpenPositions && guard-->0) CloseOne(OrdersTotal()-1); }
  double ml=AccountMargin()>0?AccountEquity()/AccountMargin()*100.0:0;
  if(ml>0 && ml<MinMarginLevel && TimeCurrent()-lastWarn>300){ lastWarn=TimeCurrent(); Alert("RiskGuard: margin level ",DoubleToString(ml,0),"% is low."); }
  Comment("TickWealth RiskGuard\nDay loss: ",DoubleToString(dl,2),"% / ",MaxDailyLossPercent,"%\nDrawdown: ",DoubleToString(dd,2),"% / ",MaxDrawdownPercent,"%\nStatus: ",halted?"HALTED":"watching"); }
