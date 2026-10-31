//+------------------------------------------------------------------+
//| TickWealth SimpleMA (MT5). Educational EMA-cross EA. One trade   |
//| at a time, fixed SL/TP, risk-based lot size. No Martingale, no   |
//| grid, no hedging, no scalping. DEMO ONLY until tested for weeks. |
//| It automates a rule; it is not an edge and can lose money.       |
//+------------------------------------------------------------------+
#property strict
#property version "1.00"
#include <Trade/Trade.mqh>
input int    FastPeriod=20;  input int SlowPeriod=50;
input double StopLossPips=30; input double TakeProfitPips=60;
input double RiskPercent=1.0; input ulong Magic=550101;
CTrade trade; int hF=INVALID_HANDLE,hS=INVALID_HANDLE; datetime lastBar=0;
int OnInit(){
  hF=iMA(_Symbol,_Period,FastPeriod,0,MODE_EMA,PRICE_CLOSE); hS=iMA(_Symbol,_Period,SlowPeriod,0,MODE_EMA,PRICE_CLOSE);
  if(hF==INVALID_HANDLE||hS==INVALID_HANDLE) return INIT_FAILED; trade.SetExpertMagicNumber(Magic); return INIT_SUCCEEDED; }
double Pip(){ return (_Digits==3||_Digits==5)?_Point*10:_Point; }
double Lots(double slPips){
  double tv=SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_VALUE), ts=SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_SIZE);
  if(ts<=0||tv<=0) return 0; double perLot=slPips*Pip()/ts*tv;
  double l=AccountInfoDouble(ACCOUNT_EQUITY)*RiskPercent/100.0/perLot;
  double st=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_STEP), mn=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MIN), mx=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MAX);
  l=MathFloor(l/st)*st; return MathMax(mn,MathMin(mx,l)); }
bool HasPos(){ for(int i=PositionsTotal()-1;i>=0;i--){ if(PositionGetSymbol(i)==_Symbol && PositionGetInteger(POSITION_MAGIC)==(long)Magic) return true; } return false; }
void OnTick(){
  datetime bar=iTime(_Symbol,_Period,0); if(bar==lastBar) return; lastBar=bar;       // act once per new bar
  double f[],s[]; ArraySetAsSeries(f,true); ArraySetAsSeries(s,true);
  if(CopyBuffer(hF,0,0,3,f)<3||CopyBuffer(hS,0,0,3,s)<3) return;                      // [1]=last closed bar, [2]=the one before
  bool up=f[2]<=s[2]&&f[1]>s[1], dn=f[2]>=s[2]&&f[1]<s[1];
  if(HasPos()||(!up&&!dn)) return;
  double lots=Lots(StopLossPips); if(lots<=0) return;
  double ask=SymbolInfoDouble(_Symbol,SYMBOL_ASK), bid=SymbolInfoDouble(_Symbol,SYMBOL_BID), sl=StopLossPips*Pip(), tp=TakeProfitPips*Pip();
  if(up) trade.Buy(lots,_Symbol,ask,NormalizeDouble(ask-sl,_Digits),NormalizeDouble(ask+tp,_Digits),"SimpleMA");
  else   trade.Sell(lots,_Symbol,bid,NormalizeDouble(bid+sl,_Digits),NormalizeDouble(bid-tp,_Digits),"SimpleMA"); }
