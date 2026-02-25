# backend/services/optimizer.py
from ortools.sat.python import cp_model
import calendar
import datetime

class OnCallOptimizer:
    def __init__(self, num_doctors: int, year: int, month: int, holidays: list = None, unavailable: dict = None):
        self.num_doctors = num_doctors
        self.year = year
        self.month = month
        self.num_days = calendar.monthrange(year, month)[1]
        
        # 祝日のリスト（例: [29] なら 29日が祝日）
        self.holidays = holidays or []
        # 医師ごとの不可日リスト（例: {0: [5, 12], 1: [10]}）
        self.unavailable = unavailable or {}
        
        self.model = cp_model.CpModel()
        self.night_shifts = {}  # 当直変数
        self.day_shifts = {}    # 日直変数 (日祝のみ使用)

        # ソフト制約（スコア）の重みを10倍して整数化
        self.W_WEEKDAY_NIGHT = 10  # 1.0
        self.W_SAT_NIGHT = 15      # 1.5
        self.W_SUNHOL_DAY = 5      # 0.5
        self.W_SUNHOL_NIGHT = 10   # 1.0

    def is_holiday(self, day):
        return day in self.holidays

    def is_saturday(self, day):
        return datetime.date(self.year, self.month, day).weekday() == 5

    def is_sunday_or_holiday(self, day):
        return datetime.date(self.year, self.month, day).weekday() == 6 or self.is_holiday(day)

    def build_model(self):
        """制約モデルを構築する"""
        # 1. 変数の定義
        for d in range(self.num_doctors):
            for day in range(1, self.num_days + 1):
                self.night_shifts[(d, day)] = self.model.NewBoolVar(f'night_d{d}_day{day}')
                self.day_shifts[(d, day)] = self.model.NewBoolVar(f'day_d{d}_day{day}')

        # 2. 枠の充足 ＆ 日直の有無
        for day in range(1, self.num_days + 1):
            # 毎日必ず当直1名
            self.model.AddExactlyOne(self.night_shifts[(d, day)] for d in range(self.num_doctors))
            
            if self.is_sunday_or_holiday(day):
                # 日祝は「日直」も必ず1名
                self.model.AddExactlyOne(self.day_shifts[(d, day)] for d in range(self.num_doctors))
            else:
                # 平日・土曜は「日直」枠はゼロ（誰も入らない）
                for d in range(self.num_doctors):
                    self.model.Add(self.day_shifts[(d, day)] == 0)

        # 3. ハード制約: 日祝の同日兼務不可
        for d in range(self.num_doctors):
            for day in range(1, self.num_days + 1):
                self.model.Add(self.night_shifts[(d, day)] + self.day_shifts[(d, day)] <= 1)

        # 4. ハード制約: 不可日の反映
        for d, days in self.unavailable.items():
            for day in days:
                self.model.Add(self.night_shifts[(d, day)] == 0)
                self.model.Add(self.day_shifts[(d, day)] == 0)

        # 5. ハード制約: 4日間隔ルール（日直も当直も「勤務」としてまとめてカウント）
        for d in range(self.num_doctors):
            for start_day in range(1, self.num_days - 3):
                window = []
                for offset in range(5):
                    day = start_day + offset
                    if day <= self.num_days:
                        window.append(self.night_shifts[(d, day)])
                        window.append(self.day_shifts[(d, day)])
                self.model.Add(sum(window) <= 1)

        # 6. ハード制約: 土曜当直は月1回まで
        saturdays = [day for day in range(1, self.num_days + 1) if self.is_saturday(day)]
        for d in range(self.num_doctors):
            self.model.Add(sum(self.night_shifts[(d, day)] for day in saturdays) <= 1)

        # ====================================================
        # 新規追加：ソフト制約（スコア計算と公平性）
        # ====================================================
        doctor_scores = []
        for d in range(self.num_doctors):
            score_expr = 0
            for day in range(1, self.num_days + 1):
                if self.is_sunday_or_holiday(day):
                    score_expr += self.day_shifts[(d, day)] * self.W_SUNHOL_DAY
                    score_expr += self.night_shifts[(d, day)] * self.W_SUNHOL_NIGHT
                elif self.is_saturday(day):
                    score_expr += self.night_shifts[(d, day)] * self.W_SAT_NIGHT
                else:
                    score_expr += self.night_shifts[(d, day)] * self.W_WEEKDAY_NIGHT
            
            # 各医師のスコア合計を保持する変数 (余裕をもって0〜1000の範囲)
            doc_score_var = self.model.NewIntVar(0, 1000, f'score_d{d}')
            self.model.Add(doc_score_var == score_expr)
            doctor_scores.append(doc_score_var)

        # チーム内の「最大スコア」と「最小スコア」を特定し、その差を最小化する（公平性）
        max_score = self.model.NewIntVar(0, 1000, 'max_score')
        min_score = self.model.NewIntVar(0, 1000, 'min_score')
        self.model.AddMaxEquality(max_score, doctor_scores)
        self.model.AddMinEquality(min_score, doctor_scores)
        
        # Minimizeで「一番負担の大きい人」と「一番暇な人」の差を縮める
        self.model.Minimize(max_score - min_score)
        
        # 結果表示用に保持
        self.doctor_scores = doctor_scores

    def solve(self):
        """最適化を実行して結果をデータとして返す（API用）"""
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 10.0
        
        status = solver.Solve(self.model)

        if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
            # === 成功時：データをリストや辞書に詰めて返す ===
            schedule = []
            for day in range(1, self.num_days + 1):
                day_data = {
                    "day": day,
                    "is_holiday": self.is_sunday_or_holiday(day),
                    "day_shift": None,
                    "night_shift": None
                }
                
                if self.is_sunday_or_holiday(day):
                    day_doc = next(d for d in range(self.num_doctors) if solver.Value(self.day_shifts[(d, day)]))
                    night_doc = next(d for d in range(self.num_doctors) if solver.Value(self.night_shifts[(d, day)]))
                    day_data["day_shift"] = day_doc
                    day_data["night_shift"] = night_doc
                else:
                    night_doc = next(d for d in range(self.num_doctors) if solver.Value(self.night_shifts[(d, day)]))
                    day_data["night_shift"] = night_doc
                
                schedule.append(day_data)
                
            scores = {d: solver.Value(self.doctor_scores[d]) / 10.0 for d in range(self.num_doctors)}
            
            return {
                "success": True,
                "status": "OPTIMAL" if status == cp_model.OPTIMAL else "FEASIBLE",
                "schedule": schedule,
                "scores": scores
            }
        else:
            # === 失敗時：エラーメッセージを返す ===
            return {
                "success": False,
                "message": "条件が厳しすぎて解が見つかりませんでした。休み希望などを減らしてください。"
            }

if __name__ == "__main__":
    print("最適化エンジンのテストを開始します（日祝・不可日・公平性ルール適用）...")
    
    # テストシナリオ:
    # 医師10人、2024年4月。 4月29日(月)を祝日とする。
    # 医師0は「4/1, 4/2, 4/3」が不可日。医師1は「4/29, 4/30」が不可日。
    test_holidays = [29]
    test_unavailable = {
        0: [1, 2, 3],
        1: [29, 30]
    }
    
    optimizer = OnCallOptimizer(
        num_doctors=10, 
        year=2024, 
        month=4, 
        holidays=test_holidays, 
        unavailable=test_unavailable
    )
    optimizer.build_model()
    optimizer.solve()