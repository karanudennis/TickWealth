//+------------------------------------------------------------------+
//| TickWealth RiskGuard (MT5). Opens NO trades. It protects the     |
//| account: daily loss limit, max drawdown, max open positions,     |
//| margin-level warning. Demo-test first. Not financial advice.     |
//+------------------------------------------------------------------+
#property strict
#property version "1.00"
#include <Trade/Trade.mqh>
input double MaxDailyLossPercent = 3.0;   // close all + halt for the day at this daily loss
input double MaxDrawdownPercent  = 10.0;  // close all + halt at this drop from peak equity
input int    MaxOpenPositions    = 3;     // newest positions above this number are closed
input double MinMarginLevel      = 150.0; // warn below this margin level (%)
CTrade trade; bool halted=false; int lastDay=-1; double dayEq=0, peakEq=0; datetime lastWarn=0;
int Today(){ MqlDateTime d; TimeToStruct(TimeCurrent(),d); return d.year*1000+d.day_of_year; }
int OnInit(){
  double eq=AccountInfoDouble(ACCOUNT_EQUITY);
  if(GlobalVariableCheck("RG_day") && (int)GlobalVariableGet("RG_day")==Today()){ dayEq=GlobalVariableGet("RG_eq"); } else { dayEq=eq; GlobalVariableSet("RG_eq",dayEq); GlobalVariableSet("RG_day",Today()); }
  peakEq=GlobalVariableCheck("RG_peak")?MathMax(GlobalVariableGet("RG_peak"),eq):eq;
  lastDay=Today(); EventSetTimer(1); return INIT_SUCCEEDED; }
void OnDeinit(const int r){ EventKillTimer(); Comment(""); }
void CloseAll(){ for(int i=PositionsTotal()-1;i>=0;i--){ ulong t=PositionGetTicket(i); if(t>0) trade.PositionClose(t); } }
void OnTimer(){
  if(Today()!=lastDay){ lastDay=Today(); dayEq=AccountInfoDouble(ACCOUNT_EQUITY); halted=false; GlobalVariableSet("RG_eq",dayEq); GlobalVariableSet("RG_day",lastDay); }
  double eq=AccountInfoDouble(ACCOUNT_EQUITY); if(eq>peakEq){ peakEq=eq; GlobalVariableSet("RG_peak",peakEq); }
  double dl=dayEq>0?(dayEq-eq)/dayEq*100.0:0, dd=peakEq>0?(peakEq-eq)/peakEq*100.0:0;
  if(!halted && (dl>=MaxDailyLossPercent || dd>=MaxDrawdownPercent)){ halted=true; CloseAll(); Alert("RiskGuard: limit reached. Positions closed, trading halted."); }
  if(halted) CloseAll();
  else { int guard=50; while(PositionsTotal()>MaxOpenPositions && guard-->0){ ulong t=PositionGetTicket(PositionsTotal()-1); if(t==0||!trade.PositionClose(t)) break; } }
  double ml=AccountInfoDouble(ACCOUNT_MARGIN_LEVEL);
  if(ml>0 && ml<MinMarginLevel && TimeCurrent()-lastWarn>300){ lastWarn=TimeCurrent(); Alert("RiskGuard: margin level ",DoubleToString(ml,0),"% is low."); }
  Comment("TickWealth RiskGuard\nDay loss: ",DoubleToString(dl,2),"% / ",MaxDailyLossPercent,"%\nDrawdown: ",DoubleToString(dd,2),"% / ",MaxDrawdownPercent,"%\nStatus: ",halted?"HALTED":"watching"); }
