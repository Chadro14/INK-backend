export class NotificationDto {
  id: string;
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  isRead: boolean;
  metadata?: any;
  createdAt: Date;
}