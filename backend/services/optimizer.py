# backend/services/optimizer.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple, Any

from ortools.sat.python import cp_model
import calendar
import datetime
import random


@dataclass
class ObjectiveWeights:
    # 鬯ｩ蟷｢・ｽ・｢郢晢ｽｻ繝ｻ・ｧ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｹ鬯ｩ蟷｢・ｽ・｢郢晢ｽｻ繝ｻ・ｧ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｭ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｼ鬯ｩ蟷｢・ｽ・｢髫ｴ蠑ｱ繝ｻ繝ｻ・ｽ繝ｻ・ｧ郢晢ｽｻ繝ｻ・ｭ郢晢ｽｻ郢ｧ謇假ｽｽ・ｽ繝ｻ・ｰ鬯ｩ蟷｢・ｽ・｢郢晢ｽｻ繝ｻ・ｧ鬯ｨ・ｾ陋ｹ繝ｻ・ｽ・ｽ繝ｻ・ｻ鬯ｯ・ｩ繝ｻ・･髫ｶ蜻ｵ・ｶ・｣繝ｻ・ｽ繝ｻ・ｸ郢晢ｽｻ繝ｻ・ｺ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｫ鬯ｮ・ｫ繝ｻ・ｰ郢晢ｽｻ繝ｻ・ｨ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｴ鬯ｮ・ｫ繝ｻ・ｰ郢晢ｽｻ繝ｻ・ｨ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｰ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬮｣雋ｻ・｣・ｰ髯具ｽｹ郢晢ｽｻ繝ｻ・ｽ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｾ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ 100, 50 鬯ｩ謳ｾ・ｽ・ｵ郢晢ｽｻ繝ｻ・ｺ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｪ鬯ｩ謳ｾ・ｽ・ｵ郢晢ｽｻ繝ｻ・ｺ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｩ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬮ｯ譎｢・ｽ・ｲ郢晢ｽｻ繝ｻ・ｨ鬩搾ｽｵ繝ｻ・ｲ髯橸ｽｳ陞滂ｽｲ繝ｻ・ｽ繝ｻ・ｲ驛｢・ｧ隰・∞・ｽ・ｽ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｡鬯ｩ謳ｾ・ｽ・ｵ郢晢ｽｻ繝ｻ・ｺ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・｣鬯ｩ謳ｾ・ｽ・ｵ郢晢ｽｻ繝ｻ・ｺ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｦ鬯ｩ謳ｾ・ｽ・ｵ郢晢ｽｻ繝ｻ・ｺ鬮｣蛹・ｽｽ・ｳ髯槭ｅ繝ｻ繝ｻ・ｽ繝ｻ・ｽ髴托ｽ｢隴会ｽｦ繝ｻ・ｽ繝ｻ・ｸ郢晢ｽｻ繝ｻ・ｺ鬮ｮ荵昴・遶乗ｧｭ繝ｻ繝ｻ・ｽ驕ｶ謫ｾ・ｽ・ｫ郢晢ｽｻ繝ｻ・ｸ郢晢ｽｻ繝ｻ・ｲ鬩包ｽｶ闕ｳ讖ｸ・ｽ・｣繝ｻ・ｺ鬮｣諛ｶ・ｽ・ｽ鬯ｩ謳ｾ・ｽ・ｵ郢晢ｽｻ繝ｻ・ｺ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｮ鬯ｩ謳ｾ・ｽ・ｵ郢晢ｽｻ繝ｻ・ｺ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｾ鬯ｩ謳ｾ・ｽ・ｵ郢晢ｽｻ繝ｻ・ｺ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｾ鬯ｮ・ｯ繝ｻ・ｷ郢晢ｽｻ繝ｻ・ｿ鬮ｯ・ｷ闔ｨ螟ｲ・ｽ・ｽ繝ｻ・ｱ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｰ鬯ｮ・ｯ繝ｻ・ｷ郢晢ｽｻ繝ｻ・ｿ鬮ｫ・ｰ髮具ｽｻ繝ｻ・ｽ繝ｻ・ｶ驛｢譎｢・ｽ・ｻ驛｢譎｢・ｽ・ｻ    month_fairness: int = 100
    past_sat_gap: int = 10
    past_sunhol_gap: int = 5
    gap5: int = 100
    gap6: int = 50

    sat_consec: int = 80
    score_balance: int = 30
    target: int = 10
    sunhol_fairness: int = 200
    sunhol_3rd: int = 80
    weekend_hol_3rd: int = 0
    soft_unavailable: int = 100


class OnCallOptimizer:
    """
    鬯ｯ・ｩ隰ｳ・ｾ繝ｻ・ｽ繝ｻ・ｨ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｱ鬯ｮ・ｯ繝ｻ・ｷ郢晢ｽｻ繝ｻ・ｷ鬯ｮ・｢繝ｻ・ｧ郢晢ｽｻ繝ｻ・ｲ鬮ｮ蜿冶・繝ｻ・ｽ繝ｻ・ｿ鬯ｮ・｣騾ｧ・ｮ騾包ｽ･郢晢ｽｻ繝ｻ・｢鬯ｮ・ｮ繝ｻ・｣郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｧ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ
    - 鬯ｮ・ｯ隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｷ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｳ鬯ｮ・ｫ繝ｻ・ｴ鬯ｲ繝ｻ・ｼ螟ｲ・ｽ・ｽ繝ｻ・ｽ郢晢ｽｻ繝ｻ・･鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬮ｯ讖ｸ・ｽ・｢郢晢ｽｻ繝ｻ・ｼ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬯ｯ・ｪ繝ｻ・ｰ髯ｷ・ｿ繝ｻ・･郢晢ｽｻ繝ｻ・ｳ郢晢ｽｻ繝ｻ・ｩ 1
    - 鬯ｮ・ｯ隲幢ｽｶ繝ｻ・ｽ繝ｻ・ｨ鬮ｮ遏ｩ・｡譚ｿ・ｧ郢晢ｽｻ繝ｻ・ｱ驛｢譎｢・ｽ・ｻ驛｢譎｢・ｽ・ｻ鬮ｯ讖ｸ・ｽ・｢郢晢ｽｻ繝ｻ・ｼ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬯ｯ・ｪ繝ｻ・ｰ髯ｷ・ｿ繝ｻ・･郢晢ｽｻ繝ｻ・ｳ郢晢ｽｻ繝ｻ・ｩ 1
    - 鬯ｮ・ｫ繝ｻ・ｴ鬯ｲ繝ｻ・ｼ螟ｲ・ｽ・ｽ繝ｻ・ｽ郢晢ｽｻ繝ｻ・･鬯ｯ・ｨ繝ｻ・ｾ郢晢ｽｻ繝ｻ・ｾ鬮ｫ・ｴ髮懶ｽ｣繝ｻ・ｽ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｼ鬮ｯ讖ｸ・ｽ・｢郢晢ｽｻ繝ｻ・ｽ鬮ｯ貊薙・雎｢・ｸ繝ｻ縺､ﾂ郢晢ｽｻ繝ｻ・ｶ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｴ 1 + 鬯ｮ・ｯ雋・ｽｷ繝ｻ・､隲帙・・ｽ・ｱ繝ｻ・ｪ鬮ｯ譎｢・ｽ・ｲ郢晢ｽｻ繝ｻ・ｩ 1鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬮｣雋ｻ・｣・ｰ郢晢ｽｻ繝ｻ・･鬯ｯ・ｩ雋・ｽｽ繝ｻ・｢隰・∞・ｽ・ｽ繝ｻ・ｭ鬯ｲ繝ｻ・ｼ螟ｲ・ｽ・ｽ繝ｻ・ｽ郢晢ｽｻ繝ｻ・･鬯ｮ・ｯ繝ｻ・ｷ鬮｣魃会ｽｽ・ｨ郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｼ鬯ｮ・ｯ繝ｻ・ｷ髫ｶ譛ｱ螳ｦ繝ｻ・ｧ髦ｮ蜷ｶ繝ｻ郢晢ｽｻ繝ｻ・ｸ鬮ｫ・ｶ隴幢ｽｱ陞ｳ・ｦ郢晢ｽｻ繝ｻ・ｺ驛｢譎｢・ｽ・ｻ驛｢譎｢・ｽ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ

    鬯ｩ蟷｢・ｽ・｢髫ｴ荵励・繝ｻ・ｽ繝ｻ・ｸ鬩怜遜・ｽ・ｫ驛｢譎｢・ｽ・ｻ鬯ｩ蟷｢・ｽ・｢髫ｴ謇九・隶夲ｽｨ鬮ｯ讖ｸ・ｽ・ｳ髯晢ｽｷ郢晢ｽｻ繝ｻ・ｽ陷證ｦ・ｽ・ｹ隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ
    - 鬯ｮ・ｫ繝ｻ・ｴ郢晢ｽｻ繝ｻ・ｫ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｰ鬯ｮ・ｯ繝ｻ・ｷ髯具ｽｹ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｶ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｳ
    - 鬯ｮ・ｫ繝ｻ・ｴ鬯ｲ繝ｻ・ｼ螟ｲ・ｽ・ｽ繝ｻ・ｽ郢晢ｽｻ繝ｻ・･鬯ｯ・ｨ繝ｻ・ｾ郢晢ｽｻ繝ｻ・ｾ鬮ｫ・ｴ隰ｫ・ｾ繝ｻ・ｽ繝ｻ・ｴ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬯ｮ・ｯ繝ｻ・ｷ郢晢ｽｻ繝ｻ・ｷ鬮ｫ・ｴ繝ｻ・ｴ郢晢ｽｻ繝ｻ・ｧ鬮ｯ貊薙・闔邇厄ｽｫ・､繝ｻ・ｦ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｼ鬯ｮ・ｯ繝ｻ・ｷ髫ｶ譛ｱ・｡蛛・ｽｽ・｡繝ｻ・ｷ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｦ鬩包ｽｶ隰ｫ・ｾ繝ｻ・ｽ繝ｻ・ｵ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｭ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・｢
    - 鬯ｮ・ｯ陋ｹ・ｺ繝ｻ・ｺ繝ｻ・ｷ髯ｷ螟ｲ・ｽ・ｱ鬮ｫ・ｰ陷ｴ繝ｻ・ｽ・ｽ繝ｻ・ｨ鬯ｮ・｣陋ｹ繝ｻ・ｽ・ｽ繝ｻ・ｳ鬮ｫ・ｶ隴幢ｽｱ陞ｳ・ｦ郢晢ｽｻ繝ｻ・ｺ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｭ鬯ｲ繝ｻ・ｼ螟ｲ・ｽ・ｽ繝ｻ・ｽ郢晢ｽｻ繝ｻ・･鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬮ｯ蜈ｷ・ｽ・ｹ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｯ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｼ鬯ｩ蟷｢・ｽ・｢髫ｴ謫ｾ・ｽ・ｴ驛｢譎｢・ｽ・ｻ鬯ｩ蟷｢・ｽ・｢郢晢ｽｻ繝ｻ・ｧ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬯ｩ蟷｢・ｽ・｢髫ｴ蠑ｱ繝ｻ繝ｻ・ｽ繝ｻ・ｼ髫ｴ竏ｫ豬ｹ陞溽浹遒托ｽｭ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬯ｩ蟷｢・ｽ・｢郢晢ｽｻ繝ｻ・ｧ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｷ鬯ｩ蟷｢・ｽ・｢髫ｴ蠑ｱ繝ｻ繝ｻ・ｽ繝ｻ・ｼ髫ｴ竏ｫ豬ｹ陞滉ｻ咎｣ｴ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬮ｯ讖ｸ・ｽ・ｻ郢晢ｽｻ繝ｻ・ｬ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ
    - 鬯ｮ・ｯ隲帑ｺ･諠ｧ郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｺ鬯ｮ・ｯ隶厄ｽｸ繝ｻ・ｽ繝ｻ・ｳ鬮ｯ讖ｸ・ｽ・｢郢晢ｽｻ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｸ鬮ｫ・ｶ隴幢ｽｱ陞ｳ・ｦ郢晢ｽｻ繝ｻ・ｺ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｭ髯具ｽｹ遶丞｣ｼ繝ｻ鬮ｯ貅ｽ・ｩ繧托ｽｽ・ｹ隴擾ｽｴ郢晢ｽｻ鬮ｯ蜈ｷ・ｽ・ｹ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｯ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｼ鬯ｩ蟷｢・ｽ・｢髫ｴ謫ｾ・ｽ・ｴ驛｢譎｢・ｽ・ｻ鬯ｩ蟷｢・ｽ・｢郢晢ｽｻ繝ｻ・ｧ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬯ｩ蟷｢・ｽ・｢髫ｴ蠑ｱ繝ｻ繝ｻ・ｽ繝ｻ・ｼ髫ｴ竏ｫ豬ｹ陞溽浹遒托ｽｭ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬯ｩ蟷｢・ｽ・｢郢晢ｽｻ繝ｻ・ｧ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｷ鬯ｩ蟷｢・ｽ・｢髫ｴ蠑ｱ繝ｻ繝ｻ・ｽ繝ｻ・ｼ髫ｴ竏ｫ豬ｹ陞滉ｻ咎｣ｴ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬮ｯ讖ｸ・ｽ・ｻ郢晢ｽｻ繝ｻ・ｬ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ
    - 4鬯ｮ・ｫ繝ｻ・ｴ鬯ｲ繝ｻ・ｼ螟ｲ・ｽ・ｽ繝ｻ・ｽ郢晢ｽｻ繝ｻ・･鬯ｯ・ｯ繝ｻ・ｮ郢晢ｽｻ繝ｻ・｢鬯ｯ・ｯ繝ｻ・･郢晢ｽｻ繝ｻ・ｴ鬮ｯ諛ｷ蟷ｲ郢晢ｽｻ    - 鬯ｮ・ｫ繝ｻ・ｴ髯晢ｽｷ郢晢ｽｻ・朱豪・ｹ譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｷ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｨ鬯ｩ謳ｾ・ｽ・ｵ郢晢ｽｻ繝ｻ・ｺ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬯ｮ・ｫ繝ｻ・ｴ鬯ｲ繝ｻ・ｼ螟ｲ・ｽ・ｽ繝ｻ・ｽ郢晢ｽｻ繝ｻ・･鬯ｯ・ｯ繝ｻ・ｮ郢晢ｽｻ繝ｻ・｢鬯ｯ・ｯ繝ｻ・･郢晢ｽｻ繝ｻ・ｴ鬮ｯ諛ｷ蟷ｲ郢晢ｽｻ    - 鬯ｮ・ｫ繝ｻ・ｴ髯晢ｽｶ繝ｻ・ｷ郢晢ｽｻ繝ｻ・｣郢晢ｽｻ繝ｻ・ｯ鬮｣蜴・ｽｽ・ｫ郢晢ｽｻ繝ｻ・｣鬯ｩ蟷｢・ｽ・｢郢晢ｽｻ繝ｻ・ｧ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｹ鬯ｩ蟷｢・ｽ・｢郢晢ｽｻ繝ｻ・ｧ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｳ鬯ｩ蟷｢・ｽ・｢郢晢ｽｻ繝ｻ・ｧ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・｢鬯ｮ・｣陋ｹ繝ｻ・ｽ・ｽ繝ｻ・ｳ鬯ｮ・ｮ隶守ｿｫ繝ｻ郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｸ鬯ｩ蠅灘ｾ励・・ｽ繝ｻ・ｩ鬮ｯ・ｷ髫ｨ・ｬ繝ｻ・ｧ繝ｻ・ｭ驛｢譎｢・ｽ・ｻ鬮｣雋ｻ・｣・ｰ郢晢ｽｻ繝ｻ・･郢晢ｽｻ邵ｺ・､・つ鬮ｯ・ｷ繝ｻ・ｿ郢晢ｽｻ繝ｻ・･鬮ｫ・ｰ陷ｴ繝ｻ・ｽ・ｽ繝ｻ・ｨ鬯ｯ・ｮ繝ｻ・ｫ郢晢ｽｻ繝ｻ・ｪ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｭ鬯ｮ・ｯ隶厄ｽｸ繝ｻ・ｽ繝ｻ・ｳ鬮ｯ讖ｸ・ｽ・｢郢晢ｽｻ繝ｻ・ｹ鬩包ｽｶ鬯・汚・ｽ・･繝ｻ・｢髮主叙・ｧ・ｭ郢晢ｽｻ郢晢ｽｻ繝ｻ・ｾ鬯ｮ・ｯ雋翫ｑ・ｽ・ｽ繝ｻ・｢鬮ｫ・ｲ陝ｷ・｢繝ｻ・ｽ繝ｻ・ｶ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｼ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ
    - 鬯ｮ・ｯ隲幢ｽｶ繝ｻ・ｽ繝ｻ・ｨ鬮ｮ遏ｩ・｡譚ｿ・ｧ郢晢ｽｻ繝ｻ・ｱ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｰ髯樊ｻ薙冠繝ｻ・ｱ繝ｻ・ｪ鬮ｯ譎｢・ｽ・ｲ郢晢ｽｻ繝ｻ・ｩ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬮ｯ讖ｸ・ｽ・｢郢晢ｽｻ繝ｻ・ｽ鬮ｫ・ｲ繝ｻ・､郢晢ｽｻ繝ｻ・ｦ1鬯ｮ・ｯ隲帙・・ｻ・ｸ郢晢ｽｻ繝ｻ・ｧ郢晢ｽｻ繝ｻ・ｭ鬩包ｽｶ隰ｫ・ｾ繝ｻ・ｽ繝ｻ・ｪ鬯ｩ謳ｾ・ｽ・ｵ郢晢ｽｻ繝ｻ・ｺ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｧ
    - 鬯ｮ・ｫ繝ｻ・ｴ鬯ｲ繝ｻ・ｼ螟ｲ・ｽ・ｽ繝ｻ・ｽ郢晢ｽｻ繝ｻ・･鬯ｯ・ｨ繝ｻ・ｾ郢晢ｽｻ繝ｻ・ｶ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｴ鬯ｮ・ｯ隲帙・・ｻ・ｸ郢晢ｽｻ繝ｻ・ｨ鬯ｯ菫ｶ魍堤ｹ晢ｽｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬮ｯ讖ｸ・ｽ・｢郢晢ｽｻ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｸ鬮｣雋ｻ・ｽ・ｨ驕ｶ荵怜煙繝ｻ・ｿ郢晢ｽｻ鬯ｮ・ｯ隲幢ｽｷ陝ｷ・ｲ驛｢譎｢・ｽ・ｻ
    - 鬯ｮ・ｫ繝ｻ・ｴ鬯ｲ繝ｻ・ｼ螟ｲ・ｽ・ｽ繝ｻ・ｽ郢晢ｽｻ繝ｻ・･鬯ｯ・ｨ繝ｻ・ｾ郢晢ｽｻ繝ｻ・ｾ鬮ｫ・ｴ隲・ｹ繝ｻ・ｸ隶抵ｽｭ郢晢ｽｻ鬯ｮ・ｯ繝ｻ・ｷ髫ｶ諠ｹ・ｼ竕ｫ驟ｪ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｼ鬮ｯ諛育袖繝ｻ・ｺ繝ｻ・ｷ郢晢ｽｻ繝ｻ・ｾ鬩墓得・ｽ・ｩ繝ｻ縺､ﾂ郢晢ｽｻ繝ｻ・ｶ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｴ+鬯ｮ・ｯ雋・ｽｷ繝ｻ・､隲帙・・ｽ・ｱ繝ｻ・ｪ鬮ｯ譎｢・ｽ・ｲ郢晢ｽｻ繝ｻ・ｩ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬮｣雋ｻ・ｽ・ｨ髯樊ｻゑｽｽ・ｲ郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｼ鬮ｯ讖ｸ・ｽ・｢郢晢ｽｻ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｸ鬮｣雋ｻ・ｽ・ｨ驕ｶ荵怜煙繝ｻ・ｿ郢晢ｽｻ鬯ｮ・ｯ隲幢ｽｷ陝ｷ・ｲ驛｢譎｢・ｽ・ｻ
    - locked_shifts鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬯ｮ・｢繝ｻ・ｧ郢晢ｽｻ繝ｻ・ｲ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・｢驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｺ鬯ｮ・ｯ隶厄ｽｸ繝ｻ・ｽ繝ｻ・ｳ鬮ｯ讖ｸ・ｽ・｢郢晢ｽｻ繝ｻ・ｹ鬩搾ｽｵ繝ｻ・ｺ髯ｷ・･隰ｫ・ｾ繝ｻ・ｽ繝ｻ・ｹ髫ｴ蠑ｱ繝ｻ繝ｻ・ｽ繝ｻ・ｼ髫ｴ竏ｫ豬ｹ陞溘ｑ・ｽ・ｹ隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬮ｯ譎｢・ｽ・ｲ郢晢ｽｻ繝ｻ・ｨ驛｢譎｢・ｽ・ｻ髯懶ｽ｣繝ｻ・､郢晢ｽｻ繝ｻ・ｹ髫ｴ荵励・繝ｻ・ｽ繝ｻ・ｸ鬩怜遜・ｽ・ｫ驛｢譎｢・ｽ・ｻ鬯ｩ蟷｢・ｽ・｢髫ｴ謇九・隶夲ｽｨ鬮ｯ譎｢・｣・ｰ鬩阪・謌溘・・･隲帙・・ｽ・ｹ隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ

    鬯ｩ蟷｢・ｽ・｢郢晢ｽｻ繝ｻ・ｧ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬯ｩ蟷｢・ｽ・｢髫ｴ蠑ｱ繝ｻ繝ｻ・ｽ繝ｻ・ｼ髫ｴ竏ｫ豬ｹ陞滉ｻ咎｣ｴ郢晢ｽｻ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｶ鬯ｯ・ｩ陜｣・ｺ繝ｻ・ｸ驗呻ｽｫ郢晢ｽｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｼ鬯ｮ・｢繝ｻ・ｧ郢晢ｽｻ繝ｻ・ｲ鬮ｯ譎｢・ｽ・ｯ郢晢ｽｻ繝ｻ・ｼ鬯ｯ・ｨ繝ｻ・ｾ郢晢ｽｻ繝ｻ・ｧ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬮ｫ・ｴ陝ｷ・｢繝ｻ・ｽ繝ｻ・ｪ鬯ｮ・ｫ繝ｻ・ｰ郢晢ｽｻ繝ｻ・ｨ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｰ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ
    - 鬯ｮ・ｯ雋・ｽｷ隰梧ｺｯ・ｿ・ｹ繝ｻ・ｳ鬮ｫ・ｲ繝ｻ・､郢晢ｽｻ繝ｻ・ｦ鬯ｮ・ｯ繝ｻ・ｷ鬮｣魃会ｽｽ・ｨ郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｬ鬯ｮ・ｯ隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｷ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｳ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻax-min鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ
    - 鬯ｯ・ｯ繝ｻ・ｩ鬩包ｽｨ郢ｧ謇假ｽｽ・ｽ繝ｻ・ｸ郢晢ｽｻ繝ｻ・ｻ鬮ｫ・ｰ驕堤ｬｬ・ｭ鬥ｴ鬆ｼ髣・ｽｽ繝ｻ・ｲ鬯俶攸・ｧ郢晢ｽｻ繝ｻ・ｱ驛｢譎｢・ｽ・ｻ鬯ｮ・ｫ繝ｻ・ｴ鬯ｲ繝ｻ・ｼ螟ｲ・ｽ・ｽ繝ｻ・ｽ郢晢ｽｻ繝ｻ・･鬯ｯ・ｨ繝ｻ・ｾ郢晢ｽｻ繝ｻ・ｾ鬮ｫ・ｴ隰ｫ・ｾ繝ｻ・ｽ繝ｻ・ｴ鬩搾ｽｵ繝ｻ・ｺ髯ｷ鄙ｫ繝ｻ繝ｻ・ｽ繝ｻ・ｹ髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｣鬯ｩ蟷｢・ｽ・｢髫ｴ謫ｾ・ｽ・ｴ驛｢譎｢・ｽ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬯ｯ・ｮ繝ｻ・ｯ郢晢ｽｻ繝ｻ・ｬ鬮ｫ・ｲ陝ｷ繝ｻ縺狗ｹ晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｭ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・｣
    - gap5, gap6 鬯ｮ・ｯ隲帙・・ｻ・ｸ郢晢ｽｻ繝ｻ・ｨ郢晢ｽｻ繝ｻ・｣鬩包ｽｶ隰ｫ・ｾ繝ｻ・ｽ繝ｻ・ｩ
    - 鬯ｮ・ｯ隲幢ｽｶ繝ｻ・ｽ繝ｻ・ｨ鬮ｮ遏ｩ・｡譚ｿ・ｧ郢晢ｽｻ繝ｻ・ｱ驛｢譎｢・ｽ・ｻ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｶ鬯ｮ・ｫ繝ｻ・ｴ髯晢ｽｶ繝ｻ・ｷ郢晢ｽｻ繝ｻ・｣郢晢ｽｻ繝ｻ・ｯ郢晢ｽｻ邵ｺ・､・つ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・｣鬯ｯ・ｩ隰ｳ・ｾ繝ｻ・ｽ繝ｻ・ｯ鬮ｯ讖ｸ・ｽ・｢郢晢ｽｻ繝ｻ・ｼ鬮ｯ讖ｸ・ｽ・ｻ鬯ｯ・･繝ｻ・ｴ郢晢ｽｻ繝ｻ・ｩ髯具ｽｹ郢晢ｽｻ繝ｻ・ｽ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｿ
    - 鬯ｮ・ｯ陋ｹ・ｺ繝ｻ・ｺ繝ｻ・ｷ髯ｷ螟ｲ・ｽ・ｱ鬮ｫ・ｰ陷ｴ繝ｻ・ｽ・ｽ繝ｻ・ｨ鬯ｩ蟷｢・ｽ・｢郢晢ｽｻ繝ｻ・ｧ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｿ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｼ鬯ｩ蟷｢・ｽ・｢郢晢ｽｻ繝ｻ・ｧ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｲ鬯ｩ蟷｢・ｽ・｢髫ｴ謫ｾ・ｽ・ｴ驛｢譎｢・ｽ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｨ鬯ｩ謳ｾ・ｽ・ｵ郢晢ｽｻ繝ｻ・ｺ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｸ鬯ｩ謳ｾ・ｽ・ｵ郢晢ｽｻ繝ｻ・ｺ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｮ鬯ｯ・ｮ繝ｻ・ｴ髯樊ｻゑｽｽ・ｧ髯溷ｮ茨ｽｿ・ｫ郢晢ｽｻ郢晢ｽｻ繝ｻ・ｼ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｼ
    - 鬯ｯ・ｯ繝ｻ・ｩ鬩包ｽｨ郢ｧ謇假ｽｽ・ｽ繝ｻ・ｸ郢晢ｽｻ繝ｻ・ｻ鬮ｫ・ｰ驕貞､ｧ・ｴ貅倥・闕ｳ鄙ｫ繝ｻ郢晢ｽｻ繝ｻ・ｯ鬯ｯ・ｩ陋ｹ繝ｻ・ｽ・ｽ繝ｻ・ｨ鬯ｯ・ｮ繝ｻ・ｦ郢晢ｽｻ繝ｻ・ｪ鬩搾ｽｵ繝ｻ・ｺ髯晢ｽｶ繝ｻ・ｷ郢晢ｽｻ繝ｻ・ｹ郢晢ｽｻ繝ｻ・ｧ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｳ鬯ｩ蟷｢・ｽ・｢郢晢ｽｻ繝ｻ・ｧ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・｢鬯ｩ蟷｢・ｽ・｢郢晢ｽｻ繝ｻ・ｧ鬯ｮ・ｮ陋ｹ・ｺ繝ｻ・ｨ霑ｺ・ｰ・つ郢晢ｽｻ繝ｻ・ｧ鬯ｩ蟷｢・ｽ・｢郢晢ｽｻ繝ｻ・ｧ郢晢ｽｻ邵ｺ・､・つ鬯ｮ・ｯ繝ｻ・ｷ鬮｣魃会ｽｽ・ｨ郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｬ鬯ｮ・ｯ隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｷ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｳ鬯ｮ・ｫ繝ｻ・ｲ郢晢ｽｻ繝ｻ・､驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｧ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻcore_balance鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ
    - 鬯ｮ・ｫ繝ｻ・ｴ鬯ｲ繝ｻ・ｼ螟ｲ・ｽ・ｽ繝ｻ・ｽ郢晢ｽｻ繝ｻ・･鬯ｯ・ｨ繝ｻ・ｾ郢晢ｽｻ繝ｻ・ｾ鬮ｫ・ｴ隲・ｹ繝ｻ・ｸ隶抵ｽｭ郢晢ｽｻ鬯ｮ・ｯ繝ｻ・ｷ髫ｶ諠ｹ・ｼ竏晢ｽｮ繝ｻ霎ｨ繝ｻ・ｻ髫ｶ魃会ｽｽ・｢郢晢ｽｻ繝ｻ・ｬ郢晢ｽｻ繝ｻ・ｨ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｰ鬯ｩ謳ｾ・ｽ・ｵ郢晢ｽｻ繝ｻ・ｺ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｮ鬯ｮ・ｯ隲幢ｽｶ繝ｻ・ｽ繝ｻ・ｮ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｭ鬮ｴ螟ｧ・｣・ｼ鬮ｮﾂ髯昴・繝ｻ繝ｻ・ｹ隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬮｣雋ｻ・｣・ｰ郢晢ｽｻ繝ｻ・･驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬮ｫ・ｰ隰ｦ・ｰ繝ｻ・ｽ繝ｻ・ｺ鬮ｫ・ｲ繝ｻ・､郢晢ｽｻ繝ｻ・ｦ max-min鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ
    - 鬯ｮ・ｫ繝ｻ・ｴ鬯ｲ繝ｻ・ｼ螟ｲ・ｽ・ｽ繝ｻ・ｽ郢晢ｽｻ繝ｻ・･鬯ｯ・ｨ繝ｻ・ｾ郢晢ｽｻ繝ｻ・ｾ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬯ｮ・ｯ隲帙・・ｻ・ｸ郢晢ｽｻ繝ｻ・ｨ鬮ｮ蛹ｺ・ｩ・ｸ繝ｻ・ｽ繝ｻ・ｲ郢晢ｽｻ繝ｻ・ｼ鬯ｩ蟷｢・ｽ・｢髫ｴ蜿門ｾ励・・ｽ繝ｻ・｣郢晢ｽｻ繝ｻ・ｹ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｪ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｫ鬯ｩ蟷｢・ｽ・｢髫ｴ謫ｾ・ｽ・ｴ驛｢譎｢・ｽ・ｻ鬩搾ｽｵ繝ｻ・ｺ驛｢譎｢・ｽ・ｻ    - 鬯ｮ・ｯ雋翫ｑ・ｽ・ｽ繝ｻ・｢鬯ｩ蜍溪酪雎仙､懈ｴ幄ｫ橸ｽｺ陜咎ｦｴ・ｭ繝ｻ・ｼ螟ｲ・ｽ・ｽ繝ｻ・ｽ郢晢ｽｻ繝ｻ・･鬯ｩ謳ｾ・ｽ・ｵ郢晢ｽｻ繝ｻ・ｺ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｮ鬯ｩ蟷｢・ｽ・｢郢晢ｽｻ繝ｻ・ｧ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬯ｩ蟷｢・ｽ・｢髫ｴ蠑ｱ繝ｻ繝ｻ・ｽ繝ｻ・ｼ髫ｴ竏ｫ豬ｹ陞滉ｻ咎｣ｴ郢晢ｽｻ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｶ鬯ｯ・ｩ陜｣・ｺ繝ｻ・ｸ驗呻ｽｫ郢晢ｽｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬯ｩ蟷｢・ｽ・｢髫ｴ諠ｹ・ｼ螟ｲ・ｽ・ｽ繝ｻ・ｿ郢晢ｽｻ繝ｻ・ｫ郢晢ｽｻ陷ｿ髢譌ｭ郢晢ｽｻ繝ｻ・ｹ髫ｴ謫ｾ・ｽ・ｴ驛｢譎｢・ｽ・ｻ鬩搾ｽｵ繝ｻ・ｺ驛｢譎｢・ｽ・ｻ驛｢譎｢・ｽ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻoft_unavailable鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ
    """

    W_WEEKDAY_NIGHT = 10  # 1.0
    W_SAT_NIGHT = 15      # 1.5
    W_SUNHOL_DAY = 5      # 0.5
    W_SUNHOL_NIGHT = 10   # 1.0

    def __init__(
        self,
        num_doctors: int,
        year: int,
        month: int,
        holidays: Optional[List[int]] = None,
        unavailable: Optional[Dict[int, List[Dict[str, Any]]]] = None,
        fixed_unavailable_weekdays: Optional[Dict[int, List[Dict[str, Any]]]] = None,
        prev_month_worked_days: Optional[Dict[int, List[int]]] = None,
        prev_month_last_day: Optional[int] = None,
        score_min: float = 0.5,
        score_max: float = 4.5,
        past_sat_counts: Optional[List[int]] = None,
        past_sunhol_counts: Optional[List[int]] = None,
        min_score_by_doctor: Optional[Dict[int, float]] = None,
        max_score_by_doctor: Optional[Dict[int, float]] = None,
        target_score_by_doctor: Optional[Dict[int, float]] = None,
        past_total_scores: Optional[Dict[int, float]] = None,
        sat_prev: Optional[Dict[int, bool]] = None,
        objective_weights: Optional[Dict[str, Any]] = None,
        hard_constraints: Optional[Dict[str, Any]] = None,
        locked_shifts: Optional[List[Dict[str, Any]]] = None,
    ):
        self.num_doctors = num_doctors
        self.year = year
        self.month = month
        self.num_days = calendar.monthrange(year, month)[1]

        self.holidays = holidays or []
        self.unavailable = unavailable or {}
        self.fixed_unavailable_weekdays = fixed_unavailable_weekdays or {}

        self.prev_month_worked_days = prev_month_worked_days or {}
        self.prev_month_last_day = prev_month_last_day

        self.score_min_float = score_min
        self.score_max_float = score_max

        self.past_sat_counts = past_sat_counts or []
        self.past_sunhol_counts = past_sunhol_counts or []

        self.min_score_by_doctor = min_score_by_doctor or {}
        self.max_score_by_doctor = max_score_by_doctor or {}
        self.target_score_by_doctor = target_score_by_doctor or {}
        self.past_total_scores = past_total_scores or {}
        self.sat_prev = sat_prev or {}
        self.hard_constraints = hard_constraints or {}

        # locked_shifts are normalized to doctor_idx at the router boundary.
        self.locked_shifts = locked_shifts or []

        ow = objective_weights or {}
        self.objective_weights = ObjectiveWeights(
            month_fairness=int(ow.get("month_fairness", 100)),
            past_sat_gap=int(ow.get("past_sat_gap", 10)),
            past_sunhol_gap=int(ow.get("past_sunhol_gap", 5)),
            gap5=int(ow.get("gap5", 100)),
            gap6=int(ow.get("gap6", 50)),
            sat_consec=int(ow.get("sat_consec", 80)),
            score_balance=int(ow.get("score_balance", 30)),
            target=int(ow.get("target", 10)),
            sunhol_fairness=int(ow.get("sunhol_fairness", 200)),
            sunhol_3rd=int(ow.get("sunhol_3rd", 80)),
            weekend_hol_3rd=int(ow.get("weekend_hol_3rd", 0)),
            soft_unavailable=int(ow.get("soft_unavailable", 100)),
        )

        self.model = cp_model.CpModel()

        self.night_shifts: Dict[Tuple[int, int], cp_model.IntVar] = {}
        self.day_shifts: Dict[Tuple[int, int], cp_model.IntVar] = {}
        self.work: Dict[Tuple[int, int], cp_model.IntVar] = {}

        self.doctor_scores: List[cp_model.IntVar] = []
        self.max_score: Optional[cp_model.IntVar] = None
        self.min_score: Optional[cp_model.IntVar] = None

    def is_holiday(self, day: int) -> bool:
        return day in self.holidays

    def is_saturday(self, day: int) -> bool:
        return datetime.date(self.year, self.month, day).weekday() == 5

    def is_sunday(self, day: int) -> bool:
        return datetime.date(self.year, self.month, day).weekday() == 6

    def is_sunday_or_holiday(self, day: int) -> bool:
        return self.is_sunday(day) or self.is_holiday(day)

    def _get_past(self, arr: List[int], d: int) -> int:
        return arr[d] if d < len(arr) else 0

    def _parse_locked_day(self, raw_date: Any) -> Optional[int]:
        """
        locked_shifts 鬯ｩ謳ｾ・ｽ・ｵ郢晢ｽｻ繝ｻ・ｺ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｮ date 鬯ｩ蟷｢・ｽ・｢郢晢ｽｻ繝ｻ・ｧ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻoptimizer 鬯ｮ・ｯ繝ｻ・ｷ繝ｻ縺､ﾂ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ郢晢ｽｻ闕ｳ・ｻ繝ｻ・､郢ｧ謇假ｽｽ・ｽ繝ｻ・ｸ郢晢ｽｻ繝ｻ・ｺ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｮ day(1..num_days) 鬯ｩ謳ｾ・ｽ・ｵ郢晢ｽｻ繝ｻ・ｺ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｫ鬯ｮ・ｯ隶灘･・ｽｽ・ｺ繝ｻ・ｽ髯具ｽｻ繝ｻ・､鬯ｯ・ｩ繝ｻ・ｪ郢晢ｽｻ繝ｻ・､鬯ｩ謳ｾ・ｽ・ｵ郢晢ｽｻ繝ｻ・ｺ鬮ｯ・ｷ繝ｻ・ｷ郢晢ｽｻ繝ｻ・ｶ驛｢譎｢・ｽ・ｻ髴托ｽ｢隴会ｽｦ繝ｻ・ｽ繝ｻ・ｸ郢晢ｽｻ繝ｻ・ｲ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ

        鬯ｮ・ｯ繝ｻ・ｷ鬮｣魃会ｽｽ・ｨ郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・･鬯ｮ・ｯ繝ｻ・ｷ髴大｣ｼ驕懊・・ｽ繝ｻ・ｸ髯ｷ・ｷ繝ｻ・ｮ驛｢譎｢・ｽ・ｻ鬯ｩ謳ｾ・ｽ・ｵ郢晢ｽｻ繝ｻ・ｺ鬮ｯ・ｷ闔ｨ螟ｲ・ｽ・ｽ繝ｻ・ｱ鬩包ｽｯ繝ｻ・ｶ郢晢ｽｻ繝ｻ・ｻ鬯ｯ・ｮ繝ｻ・ｫ郢晢ｽｻ繝ｻ・ｪ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｱ鬯ｮ・ｯ隶厄ｽｸ繝ｻ・ｽ繝ｻ・ｳ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｹ鬯ｩ謳ｾ・ｽ・ｵ郢晢ｽｻ繝ｻ・ｺ鬮ｯ・ｷ繝ｻ・ｷ郢晢ｽｻ繝ｻ・ｶ驛｢譎｢・ｽ・ｻ鬩阪・鞫ｩ繝ｻ・ｱ髣雁ｾ後・郢晢ｽｻ繝ｻ・､:
        - day-of-month 鬯ｩ謳ｾ・ｽ・ｵ郢晢ｽｻ繝ｻ・ｺ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｮ int / str鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬮｣雋ｻ・｣・ｰ髯具ｽｹ郢晢ｽｻ繝ｻ・ｽ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｾ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ 15, "15"鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ
        - ISO鬯ｮ・ｫ繝ｻ・ｴ鬯ｲ繝ｻ・ｼ螟ｲ・ｽ・ｽ繝ｻ・ｽ郢晢ｽｻ繝ｻ・･鬯ｮ・｣騾搾ｽｲ郢晢ｽｻ郢晢ｽｻ繝ｻ・ｿ郢晢ｽｻ繝ｻ・ｶ鬮ｫ・ｴ繝ｻ・ｫ髯樊ｻ・｣ｰ謇假ｽｽ・ｰ陝ｷ繝ｻ・ｽ・ｫ繝ｻ・､髫ｲ蟶ｷ・ｿ・ｫ郢晢ｽｻ / date / datetime鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬮｣雋ｻ・｣・ｰ髯具ｽｹ郢晢ｽｻ繝ｻ・ｽ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｾ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ "2026-03-15", date(2026, 3, 15)鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ
        """
        day: Optional[int] = None
        if isinstance(raw_date, int):
            day = raw_date
        elif isinstance(raw_date, str):
            s = raw_date.strip()
            if s.isdigit():
                day = int(s)
            else:
                try:
                    parsed = datetime.date.fromisoformat(s)
                    if parsed.year == self.year and parsed.month == self.month:
                        day = parsed.day
                except ValueError:
                    return None
        elif isinstance(raw_date, datetime.datetime):
            if raw_date.year == self.year and raw_date.month == self.month:
                day = raw_date.day
        elif isinstance(raw_date, datetime.date):
            if raw_date.year == self.year and raw_date.month == self.month:
                day = raw_date.day

        if day is None:
            return None
        if 1 <= day <= self.num_days:
            return day
        return None

    def _normalize_shift_type(self, raw_shift_type: Any) -> Optional[str]:
        s = str(raw_shift_type).strip().lower()
        if s in {"night", "night_shift"}:
            return "night"
        if s in {"day", "day_shift"}:
            return "day"
        return None

    def _normalize_unavailable_entry(self, item: Any) -> Optional[Dict[str, Any]]:
        if isinstance(item, int):
            if 1 <= item <= self.num_days:
                return {"date": item, "target_shift": "all", "is_soft_penalty": False}
            return None

        if not isinstance(item, dict):
            return None

        try:
            day = int(item.get("date"))
        except (TypeError, ValueError):
            return None

        if not (1 <= day <= self.num_days):
            return None

        shift_type = str(item.get("target_shift", "all")).strip().lower()
        if shift_type not in {"all", "day", "night"}:
            shift_type = "all"

        return {
            "date": day,
            "target_shift": shift_type,
            "is_soft_penalty": bool(item.get("is_soft_penalty", False)),
        }

    def _normalize_fixed_weekday_entry(self, item: Any) -> Optional[Dict[str, Any]]:
        if isinstance(item, int):
            if 0 <= item <= 6:
                return {"day_of_week": item, "target_shift": "all", "is_soft_penalty": False}
            return None

        if not isinstance(item, dict):
            return None

        try:
            day_of_week = int(item.get("day_of_week"))
        except (TypeError, ValueError):
            return None

        if not (0 <= day_of_week <= 6):
            return None

        shift_type = str(item.get("target_shift", "all")).strip().lower()
        if shift_type not in {"all", "day", "night"}:
            shift_type = "all"

        return {
            "day_of_week": day_of_week,
            "target_shift": shift_type,
            "is_soft_penalty": bool(item.get("is_soft_penalty", False)),
        }

    def _coerce_positive_int(self, raw: Any) -> Optional[int]:
        if raw is None:
            return None
        if isinstance(raw, bool):
            return 1 if raw else None
        if isinstance(raw, (int, float)):
            value = int(raw)
            return value if value > 0 else None
        if isinstance(raw, str):
            s = raw.strip().lower()
            if not s or s in {"0", "false", "off", "none", "null"}:
                return None
            try:
                value = int(float(s))
            except ValueError:
                return None
            return value if value > 0 else None
        if isinstance(raw, dict):
            enabled = raw.get("enabled", raw.get("is_enabled", raw.get("active", raw.get("on"))))
            if enabled is False:
                return None
            for key in ("value", "limit", "max", "count", "days"):
                if key in raw:
                    return self._coerce_positive_int(raw.get(key))
        return None

    def _is_explicitly_enabled(self, raw: Any) -> bool:
        if raw is True:
            return True
        if isinstance(raw, (int, float)):
            return int(raw) > 0
        if isinstance(raw, str):
            return raw.strip().lower() in {"true", "on", "enabled"}
        if isinstance(raw, dict):
            enabled = raw.get("enabled", raw.get("is_enabled", raw.get("active", raw.get("on"))))
            return enabled is True
        return False

    def _is_explicitly_disabled(self, raw: Any) -> bool:
        if raw is False:
            return True
        if isinstance(raw, (int, float)):
            return int(raw) <= 0
        if isinstance(raw, str):
            return raw.strip().lower() in {"0", "false", "off", "none", "null"}
        if isinstance(raw, dict):
            enabled = raw.get("enabled", raw.get("is_enabled", raw.get("active", raw.get("on"))))
            if enabled is not None:
                return self._is_explicitly_disabled(enabled)
        return False

    def _get_hard_constraint_value(
        self,
        default: Optional[int],
        *keys: str,
        flag_keys: Tuple[str, ...] = (),
    ) -> Optional[int]:
        for flag_key in flag_keys:
            if flag_key in self.hard_constraints and self._is_explicitly_disabled(self.hard_constraints[flag_key]):
                return None

        for key in keys:
            if key not in self.hard_constraints:
                continue

            raw = self.hard_constraints[key]
            value = self._coerce_positive_int(raw)
            if value is not None:
                return value
            if self._is_explicitly_enabled(raw):
                return default
            return None

        return default

    def build_model(self) -> None:
        doctors = range(self.num_doctors)
        days = range(1, self.num_days + 1)

        spacing_days = self._get_hard_constraint_value(
            4,
            "interval_days",
            "min_interval_days",
            "spacing_days",
            "min_gap_days",
            "work_interval_days",
        )
        max_saturday_nights = self._get_hard_constraint_value(
            1,
            "max_saturday_nights",
            "max_sat_nights",
            "sat_night_max",
            "saturday_night_max",
        )
        max_sunhol_days = self._get_hard_constraint_value(
            2,
            "max_sunhol_days",
            "sunhol_day_max",
            "max_holiday_days",
            "max_sunday_holiday_days",
        )
        max_sunhol_works = self._get_hard_constraint_value(
            3,
            "max_sunhol_works",
            "sunhol_work_max",
            "max_holiday_works",
            "max_sunday_holiday_works",
        )
        max_weekend_holiday_works = self._get_hard_constraint_value(
            None,
            "max_weekend_holiday_works",
            "weekend_holiday_work_max",
            "weekend_hol_work_max",
            "max_weekend_holiday_count",
            "weekend_holiday_total_max",
            "weekend_hol_total_max",
            "max_shifts",
            flag_keys=("strict_weekend_hol_max",),
        )

        def weekend_holiday_work_expr(doctor_idx: int):
            return sum(
                self.day_shifts[(doctor_idx, day)] + self.night_shifts[(doctor_idx, day)]
                if self.is_sunday_or_holiday(day)
                else self.night_shifts[(doctor_idx, day)]
                for day in days
                if self.is_sunday_or_holiday(day) or self.is_saturday(day)
            )

        # 1) vars
        for d in doctors:
            for day in days:
                self.night_shifts[(d, day)] = self.model.NewBoolVar(f"night_d{d}_day{day}")
                self.day_shifts[(d, day)] = self.model.NewBoolVar(f"day_d{d}_day{day}")
                self.work[(d, day)] = self.model.NewBoolVar(f"work_d{d}_day{day}")
                self.model.Add(self.work[(d, day)] == self.night_shifts[(d, day)] + self.day_shifts[(d, day)])

        # 2) slot fulfillment
        for day in days:
            self.model.AddExactlyOne(self.night_shifts[(d, day)] for d in doctors)
            if self.is_sunday_or_holiday(day):
                self.model.AddExactlyOne(self.day_shifts[(d, day)] for d in doctors)
            else:
                for d in doctors:
                    self.model.Add(self.day_shifts[(d, day)] == 0)

        # 3) hard: 鬯ｮ・ｫ繝ｻ・ｴ鬯ｲ繝ｻ・ｼ螟ｲ・ｽ・ｽ繝ｻ・ｽ郢晢ｽｻ繝ｻ・･鬯ｯ・ｨ繝ｻ・ｾ郢晢ｽｻ繝ｻ・ｾ鬮ｫ・ｴ闕ｳ・ｻ雎絶悪・ｹ譎｢・ｽ・ｻ鬯ｮ・ｫ繝ｻ・ｴ鬯ｲ繝ｻ・ｼ螟ｲ・ｽ・ｽ繝ｻ・ｽ郢晢ｽｻ繝ｻ・･鬯ｮ・ｯ繝ｻ・ｷ鬮｣魃会ｽｽ・ｨ郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｼ鬯ｮ・ｯ繝ｻ・ｷ髫ｶ譛ｱ・｡蛛・ｽｽ・｡繝ｻ・ｷ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｦ鬩包ｽｶ隰ｫ・ｾ繝ｻ・ｽ繝ｻ・ｵ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｭ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・｢
        for d in doctors:
            for day in days:
                self.model.Add(self.night_shifts[(d, day)] + self.day_shifts[(d, day)] <= 1)

        # 3.5) hard: 鬯ｯ・ｩ陟・瑳繝ｻ郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｺ鬯ｮ・ｯ隶厄ｽｸ繝ｻ・ｽ繝ｻ・ｳ鬮ｯ讖ｸ・ｽ・｢郢晢ｽｻ繝ｻ・ｹ鬩搾ｽｵ繝ｻ・ｺ髯ｷ・･隰ｫ・ｾ繝ｻ・ｽ繝ｻ・ｹ髫ｴ蠑ｱ繝ｻ繝ｻ・ｽ繝ｻ・ｼ髫ｴ竏ｫ豬ｹ陞溘ｑ・ｽ・ｹ隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻocked_shifts鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬮ｯ譎｢・ｽ・ｲ郢晢ｽｻ繝ｻ・ｨ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬯ｮ・ｯ隲帑ｺ･諠ｧ郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｺ鬯ｮ・ｯ隶厄ｽｸ繝ｻ・ｽ繝ｻ・ｳ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ
        # router/service 鬯ｮ・ｯ陷ｿ・･繝ｻ・ｹ繝ｻ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｴ鬯ｩ謳ｾ・ｽ・ｵ郢晢ｽｻ繝ｻ・ｺ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｧ UUID -> doctor_idx 鬯ｩ謳ｾ・ｽ・ｵ郢晢ｽｻ繝ｻ・ｺ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｫ鬯ｮ・ｮ陟托ｽｱ郢晢ｽｻ郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｣鬯ｯ・ｮ繝ｻ・ｫ鬩包ｽｨ郢ｧ謇假ｽｽ・ｽ繝ｻ・ｸ髫ｶ謚ｵ・ｽ・ｫ髯昴・繝ｻ邵ｺ蜉ｱ繝ｻ繝ｻ・ｺ鬯ｮ・ｴ鬩帙・・ｽ・ｲ繝ｻ・ｻ郢晢ｽｻ繝ｻ・ｽ髫ｶ蜻ｵ・ｶ・｣繝ｻ・ｽ繝ｻ・ｸ郢晢ｽｻ繝ｻ・ｺ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｦ鬯ｩ謳ｾ・ｽ・ｵ郢晢ｽｻ繝ｻ・ｺ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ鬩阪・謌溽ｫ包ｽｧ鬯ｮ・｢繝ｻ・ｧ郢晢ｽｻ繝ｻ・ｴ鬯ｩ蜉ｱ・代・・ｽ繝ｻ・ｲ
        for item in self.locked_shifts:
            if not isinstance(item, dict):
                continue

            doctor_idx = item.get("doctor_idx")
            if doctor_idx is None:
                continue
            try:
                d = int(doctor_idx)
            except (TypeError, ValueError):
                continue
            if d < 0 or d >= self.num_doctors:
                continue

            day = self._parse_locked_day(item.get("date"))
            if day is None:
                continue

            shift = self._normalize_shift_type(item.get("shift_type"))
            if shift is None:
                continue

            if shift == "night":
                self.model.Add(self.night_shifts[(d, day)] == 1)
            else:
                self.model.Add(self.day_shifts[(d, day)] == 1)

        # === 鬯ｮ・ｯ雋翫ｑ・ｽ・ｽ繝ｻ・｢鬯ｩ蜍溪酪雎仙､懈ｴ幄ｫ橸ｽｺ陜咎ｦｴ・ｭ繝ｻ・ｼ螟ｲ・ｽ・ｽ繝ｻ・ｽ郢晢ｽｻ繝ｻ・･鬯ｩ謳ｾ・ｽ・ｵ郢晢ｽｻ繝ｻ・ｺ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｮ鬯ｩ蟷｢・ｽ・｢郢晢ｽｻ繝ｻ・ｧ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬯ｩ蟷｢・ｽ・｢髫ｴ蠑ｱ繝ｻ繝ｻ・ｽ繝ｻ・ｼ髫ｴ竏ｫ豬ｹ陞滉ｻ咎｣ｴ郢晢ｽｻ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｶ鬯ｯ・ｩ陜｣・ｺ繝ｻ・ｸ驗呻ｽｫ郢晢ｽｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬯ｩ蟷｢・ｽ・｢髫ｴ諠ｹ・ｼ螟ｲ・ｽ・ｽ繝ｻ・ｿ郢晢ｽｻ繝ｻ・ｫ郢晢ｽｻ陷ｿ髢譌ｭ郢晢ｽｻ繝ｻ・ｹ髫ｴ謫ｾ・ｽ・ｴ驛｢譎｢・ｽ・ｻ鬩搾ｽｵ繝ｻ・ｺ驛｢譎｢・ｽ・ｻ繝ｻ縺､ﾂ髯具ｽｹ郢晢ｽｻ繝ｻ・ｽ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｨ鬯ｯ・ｯ繝ｻ・ｩ髮倶ｼ∝ｱｮ繝ｻ・ｽ繝ｻ・ｦ鬩怜遜・ｽ・ｫ驛｢譎｢・ｽ・ｻ ===
        soft_unavail_penalties = []

        # 4) 鬯ｮ・ｯ陋ｹ・ｺ繝ｻ・ｺ繝ｻ・ｷ髯ｷ螟ｲ・ｽ・ｱ鬮ｫ・ｰ陷ｴ繝ｻ・ｽ・ｽ繝ｻ・ｨ鬯ｮ・｣陋ｹ繝ｻ・ｽ・ｽ繝ｻ・ｳ鬮ｫ・ｶ隴幢ｽｱ陞ｳ・ｦ郢晢ｽｻ繝ｻ・ｺ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｭ鬯ｲ繝ｻ・ｼ螟ｲ・ｽ・ｽ繝ｻ・ｽ郢晢ｽｻ繝ｻ・･鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬮ｯ蜈ｷ・ｽ・ｹ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｯ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｼ鬯ｩ蟷｢・ｽ・｢髫ｴ謫ｾ・ｽ・ｴ驛｢譎｢・ｽ・ｻ鬯ｩ蟷｢・ｽ・｢郢晢ｽｻ繝ｻ・ｧ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬯ｩ蟷｢・ｽ・｢髫ｴ蠑ｱ繝ｻ繝ｻ・ｽ繝ｻ・ｼ髫ｴ竏ｫ豬ｹ陞溽浹遒托ｽｭ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬯ｩ蟷｢・ｽ・｢郢晢ｽｻ繝ｻ・ｧ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｷ鬯ｩ蟷｢・ｽ・｢髫ｴ蠑ｱ繝ｻ繝ｻ・ｽ繝ｻ・ｼ髫ｴ竏ｫ豬ｹ陞滉ｻ咎｣ｴ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬮ｯ讖ｸ・ｽ・ｻ郢晢ｽｻ繝ｻ・ｬ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ
        for d, items in self.unavailable.items():
            for item in items:
                normalized = self._normalize_unavailable_entry(item)
                if normalized is None:
                    continue

                day = normalized["date"]
                shift_type = normalized["target_shift"]
                is_soft = normalized["is_soft_penalty"]

                vars_to_constrain = []
                if shift_type in ["day", "all"]:
                    vars_to_constrain.append(self.day_shifts[(d, day)])
                if shift_type in ["night", "all"]:
                    vars_to_constrain.append(self.night_shifts[(d, day)])

                for var in vars_to_constrain:
                    if is_soft:
                        p_var = self.model.NewBoolVar(f"soft_unavail_d{d}_day{day}_{shift_type}")
                        self.model.Add(p_var == var)
                        soft_unavail_penalties.append(p_var)
                    else:
                        self.model.Add(var == 0)

        # 5) 鬯ｮ・ｯ隲帑ｺ･諠ｧ郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｺ鬯ｮ・ｯ隶厄ｽｸ繝ｻ・ｽ繝ｻ・ｳ鬮ｯ讖ｸ・ｽ・｢郢晢ｽｻ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｸ鬮ｫ・ｶ隴幢ｽｱ陞ｳ・ｦ郢晢ｽｻ繝ｻ・ｺ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｭ髯具ｽｹ遶丞｣ｼ繝ｻ鬮ｯ貅ｽ・ｩ繧托ｽｽ・ｹ隴擾ｽｴ郢晢ｽｻ鬮ｯ諛育袖繝ｻ・ｻ郢ｧ謇假ｽｽ・ｽ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｯ鬮ｫ・ｴ陝ｷ・｢繝ｻ・ｽ繝ｻ・ｱ郢晢ｽｻ邵ｺ・､・つ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｱ鬯ｩ謳ｾ・ｽ・ｵ郢晢ｽｻ繝ｻ・ｲ鬩包ｽｶ闕ｳ讖ｸ・ｽ・｣繝ｻ・ｹ繝ｻ雜｣・ｽ・｡鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｼ鬯ｩ蟷｢・ｽ・｢髫ｴ謫ｾ・ｽ・ｴ驛｢譎｢・ｽ・ｻ鬯ｩ蟷｢・ｽ・｢郢晢ｽｻ繝ｻ・ｧ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬯ｩ蟷｢・ｽ・｢髫ｴ蠑ｱ繝ｻ繝ｻ・ｽ繝ｻ・ｼ髫ｴ竏ｫ豬ｹ陞溽浹遒托ｽｭ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬯ｩ蟷｢・ｽ・｢郢晢ｽｻ繝ｻ・ｧ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｷ鬯ｩ蟷｢・ｽ・｢髫ｴ蠑ｱ繝ｻ繝ｻ・ｽ繝ｻ・ｼ髫ｴ竏ｫ豬ｹ陞滉ｻ咎｣ｴ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬮ｯ讖ｸ・ｽ・ｻ郢晢ｽｻ繝ｻ・ｬ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ
        for d, items in self.fixed_unavailable_weekdays.items():
            for item in items:
                normalized = self._normalize_fixed_weekday_entry(item)
                if normalized is None:
                    continue

                target_dow = normalized["day_of_week"]
                shift_type = normalized["target_shift"]
                is_soft = normalized["is_soft_penalty"]

                for day in days:
                    wd = datetime.date(self.year, self.month, day).weekday()
                    if wd == target_dow:
                        vars_to_constrain = []
                        if shift_type in ["day", "all"]:
                            vars_to_constrain.append(self.day_shifts[(d, day)])
                        if shift_type in ["night", "all"]:
                            vars_to_constrain.append(self.night_shifts[(d, day)])

                        for var in vars_to_constrain:
                            if is_soft:
                                p_var = self.model.NewBoolVar(f"soft_dow_d{d}_day{day}_{shift_type}")
                                self.model.Add(p_var == var)
                                soft_unavail_penalties.append(p_var)
                            else:
                                self.model.Add(var == 0)

        # 7) hard: spacing rule
        if spacing_days is not None:
            for d in doctors:
                for day in days:
                    for k in range(1, spacing_days + 1):
                        if day + k <= self.num_days:
                            self.model.Add(self.work[(d, day)] + self.work[(d, day + k)] <= 1)

        # 8) hard: month-cross spacing rule
        if spacing_days is not None and self.prev_month_last_day is not None:
            prev_last = int(self.prev_month_last_day)
            for d, prev_days in self.prev_month_worked_days.items():
                for prev_day in prev_days:
                    dist_to_start = (prev_last - int(prev_day)) + 1
                    if 1 <= dist_to_start <= spacing_days:
                        block_until = spacing_days + 1 - dist_to_start
                        for day in range(1, block_until + 1):
                            if 1 <= day <= self.num_days:
                                self.model.Add(self.work[(d, day)] == 0)

        saturdays = [day for day in days if self.is_saturday(day)]
        sunhol_days = [day for day in days if self.is_sunday_or_holiday(day)]

        # 9) hard: saturday night monthly cap
        if max_saturday_nights is not None:
            for d in doctors:
                self.model.Add(sum(self.night_shifts[(d, day)] for day in saturdays) <= max_saturday_nights)

        # 10) hard: sun/holiday day-shift monthly cap
        if max_sunhol_days is not None:
            for d in doctors:
                self.model.Add(sum(self.day_shifts[(d, day)] for day in sunhol_days) <= max_sunhol_days)

        # 10.5) hard: sun/holiday total-work monthly cap
        if max_sunhol_works is not None:
            for d in doctors:
                self.model.Add(
                    sum(self.day_shifts[(d, day)] + self.night_shifts[(d, day)] for day in sunhol_days) <= max_sunhol_works
                )

        # 10.6) hard: combined saturday-night + sun/holiday-work monthly cap
        if max_weekend_holiday_works is not None:
            for d in doctors:
                self.model.Add(weekend_holiday_work_expr(d) <= max_weekend_holiday_works)

        # 11) hard: 鬯ｮ・ｫ繝ｻ・ｴ髯晢ｽｶ繝ｻ・ｷ郢晢ｽｻ繝ｻ・｣郢晢ｽｻ繝ｻ・ｯ鬮｣蜴・ｽｽ・ｫ郢晢ｽｻ繝ｻ・｣鬯ｩ蟷｢・ｽ・｢郢晢ｽｻ繝ｻ・ｧ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｹ鬯ｩ蟷｢・ｽ・｢郢晢ｽｻ繝ｻ・ｧ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｳ鬯ｩ蟷｢・ｽ・｢郢晢ｽｻ繝ｻ・ｧ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・｢鬯ｮ・｣陋ｹ繝ｻ・ｽ・ｽ繝ｻ・ｳ鬯ｮ・ｮ隶守ｿｫ繝ｻ郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｸ鬯ｩ蠅灘ｾ励・・ｽ繝ｻ・ｩ鬮ｯ・ｷ髫ｨ・ｬ繝ｻ・ｧ繝ｻ・ｭ驛｢譎｢・ｽ・ｻ鬮｣雋ｻ・｣・ｰ郢晢ｽｻ繝ｻ・･郢晢ｽｻ邵ｺ・､・つ鬮ｯ・ｷ繝ｻ・ｿ郢晢ｽｻ繝ｻ・･鬮ｫ・ｰ陷ｴ繝ｻ・ｽ・ｽ繝ｻ・ｨ鬯ｯ・ｮ繝ｻ・ｫ郢晢ｽｻ繝ｻ・ｪ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｭ鬯ｮ・ｯ隶厄ｽｸ繝ｻ・ｽ繝ｻ・ｳ鬮ｯ讖ｸ・ｽ・｢郢晢ｽｻ繝ｻ・ｹ鬩包ｽｶ鬯・汚・ｽ・･繝ｻ・｢髮主叙・ｧ・ｭ郢晢ｽｻ郢晢ｽｻ繝ｻ・ｾ鬯ｮ・ｯ雋翫ｑ・ｽ・ｽ繝ｻ・｢鬮ｫ・ｲ陝ｷ・｢繝ｻ・ｽ繝ｻ・ｶ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｼ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ
        doctor_scores: List[cp_model.IntVar] = []
        for d in doctors:
            score_expr = 0
            for day in days:
                if self.is_sunday_or_holiday(day):
                    score_expr += self.day_shifts[(d, day)] * self.W_SUNHOL_DAY
                    score_expr += self.night_shifts[(d, day)] * self.W_SUNHOL_NIGHT
                elif self.is_saturday(day):
                    score_expr += self.night_shifts[(d, day)] * self.W_SAT_NIGHT
                else:
                    score_expr += self.night_shifts[(d, day)] * self.W_WEEKDAY_NIGHT

            doc_score = self.model.NewIntVar(0, 2000, f"score_d{d}")
            self.model.Add(doc_score == score_expr)

            d_min = int(round(self.min_score_by_doctor.get(d, self.score_min_float) * 10))
            d_max = int(round(self.max_score_by_doctor.get(d, self.score_max_float) * 10))
            self.model.Add(doc_score >= d_min)
            self.model.Add(doc_score <= d_max)

            doctor_scores.append(doc_score)

        self.doctor_scores = doctor_scores

                # --- soft constraints ---

        gap5_vars = []
        gap6_vars = []
        for d in doctors:
            for day in days:
                if day + 5 <= self.num_days:
                    gap5_bool = self.model.NewBoolVar(f"gap5_d{d}_day{day}")
                    self.model.Add(self.work[(d, day)] + self.work[(d, day + 5)] - 1 <= gap5_bool)
                    gap5_vars.append(gap5_bool)
                if day + 6 <= self.num_days:
                    gap6_bool = self.model.NewBoolVar(f"gap6_d{d}_day{day}")
                    self.model.Add(self.work[(d, day)] + self.work[(d, day + 6)] - 1 <= gap6_bool)
                    gap6_vars.append(gap6_bool)

        gap5_sum = self.model.NewIntVar(0, 1000, "gap5_sum")
        self.model.Add(gap5_sum == sum(gap5_vars))
        gap6_sum = self.model.NewIntVar(0, 1000, "gap6_sum")
        self.model.Add(gap6_sum == sum(gap6_vars))

        sat_consec_vars = []
        for d in doctors:
            if self.sat_prev.get(d, False):
                sat_month_bool = self.model.NewBoolVar(f"sat_month_bool_d{d}")
                self.model.AddMaxEquality(sat_month_bool, [self.night_shifts[(d, sat)] for sat in saturdays])
                sat_consec_vars.append(sat_month_bool)

        sat_consec_sum = self.model.NewIntVar(0, 1000, "sat_consec_sum")
        self.model.Add(sat_consec_sum == sum(sat_consec_vars))

        target_penalties = []
        for d in doctors:
            if d in self.target_score_by_doctor:
                t_score = int(round(self.target_score_by_doctor[d] * 10))
                diff = self.model.NewIntVar(-2000, 2000, f"diff_target_d{d}")
                abs_diff = self.model.NewIntVar(0, 2000, f"abs_diff_target_d{d}")
                self.model.Add(diff == doctor_scores[d] - t_score)
                self.model.AddAbsEquality(abs_diff, diff)
                target_penalties.append(abs_diff)

        target_sum = self.model.NewIntVar(0, 10000, "target_sum")
        self.model.Add(target_sum == sum(target_penalties))

        max_score = self.model.NewIntVar(0, 2000, "max_score")
        min_score = self.model.NewIntVar(0, 2000, "min_score")
        self.model.AddMaxEquality(max_score, doctor_scores)
        self.model.AddMinEquality(min_score, doctor_scores)
        fairness = self.model.NewIntVar(0, 2000, "fairness")
        self.model.Add(fairness == max_score - min_score)

        sat_totals: List[cp_model.IntVar] = []
        for d in doctors:
            sat_count = self.model.NewIntVar(0, 10, f"sat_count_d{d}")
            self.model.Add(sat_count == sum(self.night_shifts[(d, day)] for day in saturdays))
            base = self._get_past(self.past_sat_counts, d)
            total = self.model.NewIntVar(0, 999, f"sat_total_d{d}")
            self.model.Add(total == sat_count + base)
            sat_totals.append(total)

        sat_max = self.model.NewIntVar(0, 999, "sat_max")
        sat_min = self.model.NewIntVar(0, 999, "sat_min")
        self.model.AddMaxEquality(sat_max, sat_totals)
        self.model.AddMinEquality(sat_min, sat_totals)
        sat_gap = self.model.NewIntVar(0, 999, "sat_gap")
        self.model.Add(sat_gap == sat_max - sat_min)

        sunhol_shift_counts: List[cp_model.IntVar] = []
        for d in doctors:
            sh_count = self.model.NewIntVar(0, 62, f"sunhol_count_d{d}")
            self.model.Add(
                sh_count == sum(self.day_shifts[(d, day)] + self.night_shifts[(d, day)] for day in sunhol_days)
            )
            sunhol_shift_counts.append(sh_count)

        sunhol_month_max = self.model.NewIntVar(0, 62, "sunhol_month_max")
        sunhol_month_min = self.model.NewIntVar(0, 62, "sunhol_month_min")
        self.model.AddMaxEquality(sunhol_month_max, sunhol_shift_counts)
        self.model.AddMinEquality(sunhol_month_min, sunhol_shift_counts)
        sunhol_month_gap = self.model.NewIntVar(0, 62, "sunhol_month_gap")
        self.model.Add(sunhol_month_gap == sunhol_month_max - sunhol_month_min)

        sunhol_totals: List[cp_model.IntVar] = []
        for d in doctors:
            base = self._get_past(self.past_sunhol_counts, d)
            total = self.model.NewIntVar(0, 999, f"sunhol_total_d{d}")
            self.model.Add(total == sunhol_shift_counts[d] + base)
            sunhol_totals.append(total)

        sunhol_total_max = self.model.NewIntVar(0, 999, "sunhol_total_max")
        sunhol_total_min = self.model.NewIntVar(0, 999, "sunhol_total_min")
        self.model.AddMaxEquality(sunhol_total_max, sunhol_totals)
        self.model.AddMinEquality(sunhol_total_min, sunhol_totals)
        sunhol_gap = self.model.NewIntVar(0, 999, "sunhol_gap")
        self.model.Add(sunhol_gap == sunhol_total_max - sunhol_total_min)

        total_score_with_past: List[cp_model.IntVar] = []
        for d in doctors:
            past_total = int(round(self.past_total_scores.get(d, 0.0) * 10))
            total = self.model.NewIntVar(0, 100000, f"total_score_with_past_d{d}")
            self.model.Add(total == doctor_scores[d] + past_total)
            total_score_with_past.append(total)

        score_balance_max = self.model.NewIntVar(0, 100000, "score_balance_max")
        score_balance_min = self.model.NewIntVar(0, 100000, "score_balance_min")
        self.model.AddMaxEquality(score_balance_max, total_score_with_past)
        self.model.AddMinEquality(score_balance_min, total_score_with_past)
        score_balance_gap = self.model.NewIntVar(0, 100000, "score_balance_gap")
        self.model.Add(score_balance_gap == score_balance_max - score_balance_min)

        sunhol_3rd_vars = []
        for d in doctors:
            sh_total = sum(self.day_shifts[(d, day)] + self.night_shifts[(d, day)] for day in sunhol_days)
            is_3rd = self.model.NewIntVar(0, 1, f"is_3rd_sh_d{d}")
            self.model.Add(is_3rd >= sh_total - 2)
            sunhol_3rd_vars.append(is_3rd)

        sunhol_3rd_sum = self.model.NewIntVar(0, 1000, "sunhol_3rd_sum")
        self.model.Add(sunhol_3rd_sum == sum(sunhol_3rd_vars))

        weekend_hol_3rd_vars = []
        if max_weekend_holiday_works is None:
            for d in doctors:
                weekend_hol_total = self.model.NewIntVar(0, 62, f"weekend_hol_count_d{d}")
                self.model.Add(weekend_hol_total == weekend_holiday_work_expr(d))
                is_3rd_weekend_hol = self.model.NewBoolVar(f"is_3rd_weekend_hol_d{d}")
                self.model.Add(weekend_hol_total >= 3).OnlyEnforceIf(is_3rd_weekend_hol)
                self.model.Add(weekend_hol_total <= 2).OnlyEnforceIf(is_3rd_weekend_hol.Not())
                weekend_hol_3rd_vars.append(is_3rd_weekend_hol)

        weekend_hol_3rd_sum = self.model.NewIntVar(0, 1000, "weekend_hol_3rd_sum")
        self.model.Add(weekend_hol_3rd_sum == sum(weekend_hol_3rd_vars))

        soft_unavail_sum = self.model.NewIntVar(0, 10000, "soft_unavail_sum")
        if soft_unavail_penalties:
            self.model.Add(soft_unavail_sum == sum(soft_unavail_penalties))
        else:
            self.model.Add(soft_unavail_sum == 0)

        w = self.objective_weights
        self.model.Minimize(
            w.month_fairness * fairness
            + w.past_sat_gap * sat_gap
            + w.past_sunhol_gap * sunhol_gap
            + w.sunhol_fairness * sunhol_month_gap
            + w.gap5 * gap5_sum
            + w.gap6 * gap6_sum
            + w.sat_consec * sat_consec_sum
            + w.score_balance * score_balance_gap
            + w.target * target_sum
            + w.sunhol_3rd * sunhol_3rd_sum
            + w.weekend_hol_3rd * weekend_hol_3rd_sum
            + w.soft_unavailable * soft_unavail_sum
        )
        self.max_score = max_score
        self.min_score = min_score

    def solve(self, time_limit_seconds: float = 10.0, random_seed: Optional[int] = None) -> Dict:
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = float(time_limit_seconds)
        seed = int(random_seed) if random_seed is not None else random.SystemRandom().randint(1, 2**31 - 1)
        solver.parameters.random_seed = seed
        if hasattr(solver.parameters, "randomize_search"):
            solver.parameters.randomize_search = True
        status = solver.Solve(self.model)

        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            schedule = []
            for day in range(1, self.num_days + 1):
                day_data = {
                    "day": day,
                    "is_sunhol": self.is_sunday_or_holiday(day),
                    "day_shift": None,
                    "night_shift": None,
                }
                day_data["night_shift"] = next(
                    (d for d in range(self.num_doctors) if solver.Value(self.night_shifts[(d, day)])), None
                )

                if self.is_sunday_or_holiday(day):
                    day_data["day_shift"] = next(
                        (d for d in range(self.num_doctors) if solver.Value(self.day_shifts[(d, day)])), None
                    )
                schedule.append(day_data)

            scores = {d: solver.Value(self.doctor_scores[d]) / 10.0 for d in range(self.num_doctors)}
            return {
                "success": True,
                "status": "OPTIMAL" if status == cp_model.OPTIMAL else "FEASIBLE",
                "schedule": schedule,
                "scores": scores,
            }

        return {
            "success": False,
            "message": "No feasible schedule found with the current hard constraints.",
        }


if __name__ == "__main__":
    # 鬯ｯ・ｩ鬮ｦ・ｪ郢晢ｽｻ郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｡鬯ｮ・ｫ繝ｻ・ｴ髣包ｽｵ驕会ｽｼ髯ｲ螟懈・雋・ｽｽ繝ｻ・｢髫ｨ・ｬ遶企ｷｹ・ｫ・ｴ陜捺ｻ・ｽｱ謚ｵ・ｾ荳ｻﾂ・ｬ・取鱒繝ｻ繝ｻ・ｧ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｹ鬯ｩ蟷｢・ｽ・｢髫ｴ蟇よ升邵ｺ迢暦ｽｹ譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｼ鬮ｯ諛育袖繝ｻ・ｺ繝ｻ・ｽ髫ｰ豕鯉ｽｹﾏ譁舌・繝ｻ・ｧ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｹ鬯ｩ蟷｢・ｽ・｢郢晢ｽｻ繝ｻ・ｧ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｭ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｼ鬯ｩ蟷｢・ｽ・｢髫ｴ蠑ｱ繝ｻ繝ｻ・ｽ繝ｻ・ｧ郢晢ｽｻ繝ｻ・ｭ鬩包ｽｶ鬯・汚・ｽ・･繝ｻ・｢髮主叙・ｧ・ｭ郢晢ｽｻ郢晢ｽｻ繝ｻ・ｾ鬯ｮ・ｯ雋翫ｑ・ｽ・ｽ繝ｻ・｢鬮ｫ・ｲ陝ｷ・｢繝ｻ・ｽ繝ｻ・ｶ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｼ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ
    optimizer = OnCallOptimizer(
        num_doctors=10,
        year=2024,
        month=4,
        holidays=[29],
        unavailable={0: [{"date": 1, "target_shift": "all", "is_soft_penalty": False}]},
        fixed_unavailable_weekdays={2: [{"day_of_week": 0, "target_shift": "all", "is_soft_penalty": False}]},
        prev_month_worked_days={0: [30]},
        prev_month_last_day=31,
        sat_prev={0: True},
    )
    optimizer.build_model()
    print(optimizer.solve())
