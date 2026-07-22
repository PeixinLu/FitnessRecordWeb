import QRCode from "qrcode";
import {
  formatWorkoutItemTitle,
  type TodayWorkoutExerciseItem,
} from "@/utils/todayWorkoutViews";

const SHARE_URL = "https://fit.pxone.top";
const CARD_WIDTH = 1080;
const CARD_MARGIN = 72;
const EXERCISE_GAP = 24;
const SET_ROW_HEIGHT = 56;

export interface WorkoutShareOptions {
  title: string;
  date: string;
  items: TodayWorkoutExerciseItem[];
}

export type WorkoutShareResult = "shared" | "downloaded" | "cancelled";

function drawRoundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function fillRoundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillStyle: string | CanvasGradient,
): void {
  drawRoundRect(context, x, y, width, height, radius);
  context.fillStyle = fillStyle;
  context.fill();
}

function fitText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (context.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (
    result.length > 1 &&
    context.measureText(`${result}…`).width > maxWidth
  ) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

function getExerciseCardHeight(item: TodayWorkoutExerciseItem): number {
  return 112 + item.sets.length * SET_ROW_HEIGHT + 28;
}

function getCardHeight(items: TodayWorkoutExerciseItem[]): number {
  const exerciseHeight = items.reduce(
    (total, item) => total + getExerciseCardHeight(item),
    0,
  );
  const gaps = Math.max(0, items.length - 1) * EXERCISE_GAP;
  return Math.max(1350, 330 + exerciseHeight + gaps + 260);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("无法生成分享图片"));
    }, "image/png");
  });
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function generateWorkoutShareImage(
  options: WorkoutShareOptions,
): Promise<Blob> {
  const height = getCardHeight(options.items);
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器无法生成分享图片");

  const background = context.createLinearGradient(0, 0, CARD_WIDTH, height);
  background.addColorStop(0, "#f7fbff");
  background.addColorStop(0.52, "#f4f6fa");
  background.addColorStop(1, "#eef7f1");
  context.fillStyle = background;
  context.fillRect(0, 0, CARD_WIDTH, height);

  fillRoundRect(context, CARD_MARGIN, 64, 226, 54, 27, "#e8f3ff");
  context.fillStyle = "#007aff";
  context.font =
    '600 24px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
  context.textBaseline = "middle";
  context.fillText("FITNESS RECORD", CARD_MARGIN + 24, 91);

  context.fillStyle = "#171719";
  context.font =
    '700 64px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
  context.fillText(options.title, CARD_MARGIN, 184);

  const setCount = options.items.reduce(
    (total, item) => total + item.sets.length,
    0,
  );
  context.fillStyle = "#6e6e73";
  context.font =
    '400 30px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
  context.fillText(
    `${options.date}  ·  ${options.items.length}个动作  ·  ${setCount}组`,
    CARD_MARGIN,
    246,
  );

  let cardY = 300;
  const cardWidth = CARD_WIDTH - CARD_MARGIN * 2;
  for (const item of options.items) {
    const cardHeight = getExerciseCardHeight(item);
    context.save();
    context.shadowColor = "rgba(30, 35, 45, 0.08)";
    context.shadowBlur = 28;
    context.shadowOffsetY = 10;
    fillRoundRect(
      context,
      CARD_MARGIN,
      cardY,
      cardWidth,
      cardHeight,
      34,
      "#ffffff",
    );
    context.restore();

    fillRoundRect(context, CARD_MARGIN + 28, cardY + 28, 58, 58, 18, "#edf5ff");
    context.fillStyle = "#007aff";
    context.font =
      '700 26px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
    context.textAlign = "center";
    context.fillText(
      item.exerciseName.slice(0, 1),
      CARD_MARGIN + 57,
      cardY + 57,
    );
    context.textAlign = "left";

    context.fillStyle = "#1c1c1e";
    context.font =
      '650 34px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
    context.fillText(
      fitText(
        context,
        formatWorkoutItemTitle(item.exerciseName, item.equipmentName),
        cardWidth - 250,
      ),
      CARD_MARGIN + 108,
      cardY + 57,
    );

    if (item.muscleGroup) {
      context.font =
        '600 24px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
      const muscleWidth = context.measureText(item.muscleGroup).width + 40;
      fillRoundRect(
        context,
        CARD_MARGIN + cardWidth - muscleWidth - 28,
        cardY + 32,
        muscleWidth,
        50,
        18,
        "#eef8f0",
      );
      context.fillStyle = "#248a3d";
      context.textAlign = "center";
      context.fillText(
        item.muscleGroup,
        CARD_MARGIN + cardWidth - muscleWidth / 2 - 28,
        cardY + 57,
      );
      context.textAlign = "left";
    }

    const rowsTop = cardY + 112;
    item.sets.forEach((set, index) => {
      const rowY = rowsTop + index * SET_ROW_HEIGHT;
      context.strokeStyle = "rgba(60, 60, 67, 0.1)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(CARD_MARGIN + 108, rowY);
      context.lineTo(CARD_MARGIN + cardWidth - 28, rowY);
      context.stroke();

      context.fillStyle = "#8e8e93";
      context.font =
        '400 24px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
      context.fillText(`第${index + 1}组`, CARD_MARGIN + 108, rowY + 30);

      context.fillStyle = "#3a3a3c";
      context.font =
        '500 27px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
      context.fillText(set.detail, CARD_MARGIN + 250, rowY + 30);
    });

    cardY += cardHeight + EXERCISE_GAP;
  }

  const footerY = height - 218;
  context.strokeStyle = "rgba(60, 60, 67, 0.1)";
  context.beginPath();
  context.moveTo(CARD_MARGIN, footerY - 34);
  context.lineTo(CARD_WIDTH - CARD_MARGIN, footerY - 34);
  context.stroke();

  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, SHARE_URL, {
    width: 156,
    margin: 1,
    color: { dark: "#1c1c1e", light: "#ffffff" },
  });
  fillRoundRect(context, CARD_MARGIN, footerY, 180, 180, 26, "#ffffff");
  context.drawImage(qrCanvas, CARD_MARGIN + 12, footerY + 12, 156, 156);

  context.fillStyle = "#1c1c1e";
  context.font =
    '650 30px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
  context.fillText("扫码开始记录训练", CARD_MARGIN + 218, footerY + 60);
  context.fillStyle = "#8e8e93";
  context.font =
    '400 27px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
  context.fillText("fit.pxone.top", CARD_MARGIN + 218, footerY + 108);

  return canvasToBlob(canvas);
}

export async function shareWorkoutCard(
  options: WorkoutShareOptions,
): Promise<WorkoutShareResult> {
  const blob = await generateWorkoutShareImage(options);
  const fileName = `训练记录-${options.date}.png`;
  const file = new File([blob], fileName, { type: "image/png" });
  const shareData: ShareData = { files: [file] };

  if (navigator.share && navigator.canShare?.(shareData)) {
    try {
      await navigator.share(shareData);
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "cancelled";
      }
      throw error;
    }
  }

  downloadBlob(blob, fileName);
  return "downloaded";
}
