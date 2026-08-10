# 守護獸圖片

把你做好的 32 張圖放進**這個資料夾**，檔名照下表命名即可。
系統會自動改用圖片顯示；找不到的檔案會自動退回 emoji，所以可以一次只上傳幾張，不必等全部做完。

## 命名規則

```
{物種代號}-{階段代號}.png
```

全部小寫，副檔名固定 `.png`。

## 完整檔名清單（32 張）

| 物種 | 靈卵 | 幼獸 | 成獸 | 守護神獸 |
|---|---|---|---|---|
| 台灣黑熊 | `bear-egg.png` | `bear-baby.png` | `bear-adult.png` | `bear-guardian.png` |
| 石虎 | `cat-egg.png` | `cat-baby.png` | `cat-adult.png` | `cat-guardian.png` |
| 櫻花鉤吻鮭 | `salmon-egg.png` | `salmon-baby.png` | `salmon-adult.png` | `salmon-guardian.png` |
| 帝雉 | `pheasant-egg.png` | `pheasant-baby.png` | `pheasant-adult.png` | `pheasant-guardian.png` |
| 台灣藍鵲 | `magpie-egg.png` | `magpie-baby.png` | `magpie-adult.png` | `magpie-guardian.png` |
| 穿山甲 | `pangolin-egg.png` | `pangolin-baby.png` | `pangolin-adult.png` | `pangolin-guardian.png` |
| 山羌 | `deer-egg.png` | `deer-baby.png` | `deer-adult.png` | `deer-guardian.png` |
| 台灣獼猴 | `macaque-egg.png` | `macaque-baby.png` | `macaque-adult.png` | `macaque-guardian.png` |

## 複製用的純檔名清單

```
bear-egg.png
bear-baby.png
bear-adult.png
bear-guardian.png
cat-egg.png
cat-baby.png
cat-adult.png
cat-guardian.png
salmon-egg.png
salmon-baby.png
salmon-adult.png
salmon-guardian.png
pheasant-egg.png
pheasant-baby.png
pheasant-adult.png
pheasant-guardian.png
magpie-egg.png
magpie-baby.png
magpie-adult.png
magpie-guardian.png
pangolin-egg.png
pangolin-baby.png
pangolin-adult.png
pangolin-guardian.png
deer-egg.png
deer-baby.png
deer-adult.png
deer-guardian.png
macaque-egg.png
macaque-baby.png
macaque-adult.png
macaque-guardian.png
```

## 圖片建議

| 項目 | 建議 |
|---|---|
| 尺寸 | 512 × 512 px 正方形 |
| 格式 | PNG，**去背**（透明底） |
| 檔案大小 | 單張 200KB 以內，投影模式會同時顯示 30 隻 |

去背很重要——系統的紙質背景色會透出來，白底圖會出現方框。

## 怎麼上傳

**方法一：GitHub 網頁**

1. 進到 `https://github.com/znxuyz/class/tree/main/assets/pets`
2. 右上 `Add file` → `Upload files`
3. 把圖片全部拖進去 → `Commit changes`

**方法二：命令列**

```bash
git pull
cp /你的圖片資料夾/*.png assets/pets/
git add assets/pets && git commit -m "新增守護獸圖片" && git push
```

上傳後等 GitHub Pages 重新發布（約 1 分鐘），重新整理網頁就會看到。
