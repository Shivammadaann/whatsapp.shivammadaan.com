/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  budget: string;
  owner: string;
  stage: 'New' | 'Hot' | 'Warm' | 'Cold';
  remark: string;
  department: 'digital' | 'abroad' | 'domestic' | 'store';
  dateAdded: string;
}

export interface WhatsAppPhoneNumber {
  phoneId: string;
  accountMode: string;
  codeVerificationStatus: string;
  displayPhoneNumber: string;
  messagingLimitTier: string;
  whatsappBusinessManagerMessagingLimit?: string;
  nameStatus: string;
  newNameStatus: string;
  qualityScore: string;
  status: string;
  verifiedName: string;
  wabaId: string;
  accountReviewStatus: string;
  businessVerificationStatus: string;
  qualityRating: string;
  searchVisibility?: string;
}

export interface WhatsAppPhoneNumberDetail extends WhatsAppPhoneNumber {
  searchVisibility?: string;
  wabaUpdate?: string;
  address?: string;
  description?: string;
  email?: string;
  vertical?: string;
  websites?: string[];
}

export interface WhatsAppBusinessAccount {
  id: string;
  name: string;
  currency: string;
  country: string;
  accountReviewStatus: string;
  timezoneId: string;
  messageTemplateNamespace: string;
  ownershipType: string;
  primaryFundingId: string;
  purchaseOrderNumber: string;
  businessId: string;
  businessName: string;
  businessVerificationStatus: string;
  channelId: string;
  whatsappBusinessManagerMessagingLimit: string;
}

export interface WhatsAppChannel {
  id: string;
  name: string;
  phoneNumber: string;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components: any[];
}

export interface WhatsAppBusinessProfile {
  about: string;
  address: string;
  description: string;
  email: string;
  messaging_product: string;
  profile_picture_url: string;
  websites: string[];
  vertical: string;
}

export interface WhatsAppCommerceSettings {
  catalogId?: string;
  isCatalogVisible?: boolean;
  isCartEnabled?: boolean;
  connected?: boolean;
}

export interface WhatsAppCatalogProduct {
  id?: string;
  productRetailerId?: string;
  name?: string;
  description?: string;
  currency?: string;
  price?: string;
  imageUrl?: string;
  availability?: string;
}

export interface WhatsAppCallingProbe {
  enabled: boolean;
  permissionStatus?: string;
  permissionExpiresAt?: number;
  canStartCall?: boolean;
  canRequestPermission?: boolean;
  actions?: WhatsAppCallPermissionAction[];
  message?: string;
  errorCode?: number;
  raw?: any;
}

export interface WhatsAppCallPermissionActionLimit {
  timePeriod?: string;
  maxAllowed?: number;
  currentUsage?: number;
  limitExpirationTime?: number;
}

export interface WhatsAppCallPermissionAction {
  actionName?: string;
  canPerformAction?: boolean;
  limits?: WhatsAppCallPermissionActionLimit[];
}

export interface WhatsAppCallSessionDescription {
  sdpType: 'offer' | 'answer' | 'pranswer';
  sdp: string;
}

export interface WhatsAppCallActionRequest {
  action: 'connect' | 'pre_accept' | 'accept' | 'reject' | 'terminate';
  to?: string;
  callId?: string;
  session?: WhatsAppCallSessionDescription;
  bizOpaqueCallbackData?: string;
}

export interface WhatsAppCallActionResponse {
  success: boolean;
  callId?: string;
  session?: WhatsAppCallSessionDescription | null;
  message?: string;
  raw?: any;
}

export interface WhatsAppAccountOverview extends WhatsAppBusinessProfile {
  whatsappName?: string;
  phoneId?: string;
  qualityScore?: string;
  qualityRating?: string;
  displayPhoneNumber?: string;
  messagingLimitTier?: string;
  whatsappBusinessManagerMessagingLimit?: string;
  status?: string;
  verifiedName?: string;
  wabaId?: string;
  accountReviewStatus?: string;
  businessVerificationStatus?: string;
  codeVerificationStatus?: string;
  accountMode?: string;
  nameStatus?: string;
  newNameStatus?: string;
}

export interface User {
  id: string;
  name: string;
  role: 'Administrator' | 'Agent' | 'Manager';
  email?: string;
}

export interface BroadcastSession {
  id: string;
  name: string;
  templateName: string;
  status: 'Pending' | 'Processing' | 'Completed' | 'Failed';
  totalContacts: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  repliedCount?: number;
  createdAt: string;
}

export interface AddContactRequest {
  whatsapp_number: string;
  name: string;
  custom_params?: CustomParamDto[];
}

export interface AssignContactToTeamsRequest {
  target: string;
  teams: string[];
}

export interface AssignContactToTeamsResponse {
  result?: boolean;
}

export interface AssignConversationOperatorRequest {
  assignee_email: string;
}

export interface AssignConversationOperatorResponse {
  result?: boolean;
}

export interface BroadcastDetailsDto {
  id?: string;
  channel_id?: string;
  name?: string;
  status?: string;
  template_id?: string;
  fallback_templates?: FallbackTemplate[];
  created?: string;
  last_updated?: string;
  scheduled_at?: string;
  statistics?: BroadcastStatisticsDto;
}

export interface BroadcastDto {
  id?: string;
  channel_id?: string;
  name?: string;
  status?: string;
  template_id?: string;
  fallback_templates?: FallbackTemplate[];
  created?: string;
  last_updated?: string;
  scheduled_at?: string;
}

export interface BroadcastRecipientDto {
  id?: string;
  contact_id?: string;
  contact_name?: string;
  contact_phone?: string;
  status?: string;
  failed_code?: string;
  local_message_id?: string;
  message_id?: string;
  custom_params?: CustomParamDto[];
  created?: string;
}

export interface BroadcastStatisticsDto {
  total_recipients?: number;
  total_pending?: number;
  total_queued?: number;
  total_sending?: number;
  total_sent?: number;
  total_delivered?: number;
  total_read?: number;
  total_replied?: number;
  total_failed?: number;
  total_stopped?: number;
}

export interface ButtonMessageTemplateComponentDto {
  type?: string;
  parameter?: ButtonMessageTemplateComponentParameterDto;
}

export interface ButtonMessageTemplateComponentParameterDto {
  text?: string;
  phone_number?: string;
  url?: string;
  url_original?: string;
  url_type?: string;
  button_param_mapping?: TemplateParamDto;
  copy_offer_code?: string;
  order_details?: OrderDetailsParametersDto;
}

export interface ButtonsMessageButtonsDto {
  text?: string;
}

export interface ButtonsMessageDto {
  header?: ButtonsMessageHeaderDto;
  body?: string;
  footer?: string;
  buttons?: ButtonsMessageButtonsDto[];
}

export interface ButtonsMessageHeaderDto {
  type?: string;
  text?: string;
  media?: ButtonsMessageHeaderMediaDto;
}

export interface ButtonsMessageHeaderMediaDto {
  url?: string;
  file_name?: string;
  data?: string;
  mime_type?: string;
  file_path?: string;
}

export interface CarouselMessageTemplateViewModelDto {
  header?: HeaderMessageTemplateComponentDto;
  body?: string;
  body_original?: string;
  body_param_mapping?: any;
  buttons?: any[];
  buttons_type?: string;
}

export interface CatalogInfoDto {
  catalog_id?: string;
  thumbnail_product?: CatalogProductDto;
  is_active?: boolean;
}

export interface CatalogProductDto {
  product_retailer_id?: string;
  id?: string;
  retailer_product_group_id?: string;
  price?: number;
  sale_price?: number;
  name?: string;
  currency?: string;
  image_url?: string;
  errors?: ProductErrorDto[];
}

export interface ChannelDto {
  id?: string;
  name?: string;
  channel?: string;
}

export interface ChatbotDto {
  id?: string;
  name?: string;
  created?: string;
}

export interface ContactDto {
  id?: string;
  wa_id?: string;
  name?: string;
  phone?: string;
  photo?: string;
  created?: string;
  last_updated?: string;
  contact_status?: string;
  source?: string;
  channel_id?: string;
  opted_in?: boolean;
  allow_broadcast?: boolean;
  allow_sms?: boolean;
  teams?: string[];
  segments?: string[];
  custom_params?: CustomParamDto[];
  channel_type?: string;
  display_name?: string;
  contact_link?: ContactLinkDto;
  is_broadcast_limit_reached?: boolean;
}

export interface ContactLinkDto {
  whats_app_contact_id?: string;
}

export interface ConversationEventDto {
  id?: string;
  created?: string;
  conversation_id?: string;
  ticket_id?: string;
  event_type?: string;
}

export interface CustomParamDto {
  name: string;
  value: string;
}

export interface FallbackTemplate {
  templateId?: string;
  type?: string;
  providerType?: string;
}

export interface ForbiddenRequestResponse {
  code: string;
  message: string;
  timestamp?: string;
}

export interface GetBroadcastRecipientsResponse {
  recipients?: BroadcastRecipientDto[];
  page_number?: number;
  page_size?: number;
  total_count?: number;
}

export interface GetBroadcastsOverviewResponse {
  total_links?: number;
  total_processing?: number;
  total_queued?: number;
  total_sent?: number;
  total_delivered?: number;
  total_open?: number;
  total_replied?: number;
  total_failed?: number;
  total_stopped?: number;
  total_sending?: number;
}

export interface GetBroadcastsResponse {
  broadcasts?: BroadcastDto[];
  page_number?: number;
  page_size?: number;
  total?: number;
}

export interface GetChannelsResponse {
  channels?: ChannelDto[];
}

export interface GetChatbotListResponse {
  chatbot_list?: ChatbotDto[];
  page_number?: number;
  page_size?: number;
}

export interface GetContactCountResponse {
  contact_count?: number;
}

export interface GetContactListResponse {
  contact_list?: ContactDto[];
  page_number?: number;
  page_size?: number;
}

export interface GetLeadStagesResponse {
  stages?: LeadStageItemDto[];
}

export interface GetMessageTemplatesResponse {
  templates?: MessageTemplateDto[];
  page_number?: number;
  page_size?: number;
  total?: number;
}

export interface GetMessagesByConversationIdResponse {
  message_list?: MessageDto[];
  page_number?: number;
  page_size?: number;
}

export interface GetSalesPipelineRequest {
  from: string;
  to: string;
  agentIds?: string[];
  selectedStageIds?: string[];
}

export interface GetSalesPipelineResponse {
  win_rate?: number;
  entries?: StagePipelineDto[];
}

export interface HeaderMessageTemplateComponentDto {
  type?: string;
  text?: string;
  link?: string;
  media_header_id?: string;
  media_from_pc?: boolean;
  header_original?: string;
  header_param_mapping?: TemplateParamDto;
}

export interface InvalidRequestResponse {
  code: string;
  message: string;
  timestamp?: string;
}

export interface LanguageOptionDto {
  key?: string;
  value?: string;
  text?: string;
}

export interface LeadStageItemDto {
  id?: string;
  label?: string;
  color?: string;
  sort_order?: number;
}

export interface LimitedTimeOfferDto {
  text?: string;
  has_expiration?: boolean;
  expiration_time?: string;
}

export interface ListMessageDto {
  header?: string;
  body?: string;
  footer?: string;
  button_text?: string;
  sections?: ListMessageSectionDto[];
}

export interface ListMessageSectionDto {
  title?: string;
  rows?: ListMessageSectionRowDto[];
}

export interface ListMessageSectionRowDto {
  title?: string;
  description?: string;
}

export interface MessageDto {
  text?: string;
  type?: string;
  timestamp?: string;
  owner?: boolean;
  status?: string;
  avatar_url?: string;
  assigned_id?: string;
  operator_name?: string;
  failed_detail?: string;
  bot_type?: string;
  local_message_id?: string;
  id?: string;
  created?: string;
  conversation_id?: string;
  ticket_id?: string;
  event_type?: string;
}

export interface MessageTemplateDto {
  id?: string;
  name?: string;
  category?: string;
  sub_category?: string;
  catalog_info?: CatalogInfoDto;
  hsm?: string;
  hsm_original?: string;
  custom_params?: CustomParamDto[];
  status?: string;
  language_option?: LanguageOptionDto;
  last_modified?: string;
  type?: string;
  header?: HeaderMessageTemplateComponentDto;
  body?: string;
  body_original?: string;
  footer?: string;
  buttons?: any[];
  buttons_type?: string;
  carousel_cards?: any[];
  expires_in?: number;
  include_expiry_time?: boolean;
  add_security_recommendation?: boolean;
  is_url_btn_click_tracking_enabled?: boolean;
  limited_time_offer?: LimitedTimeOfferDto;
  quality?: string;
  creation_method?: string;
}

export interface OrderDetailsParametersDto {
  reference_id?: string;
  type?: string;
  payment_configuration?: any;
  currency?: string;
  total_amount?: number;
  order?: any;
  payment_type?: string;
  beneficiaries?: any[];
  payment_settings?: any[];
  shipping_info?: any;
}

export interface ProductErrorDto {
  title?: string;
  type?: string;
}

export interface ScheduleTemplateMessagesRequest {
  channel?: string;
  template_name: string;
  broadcast_name: string;
  scheduled_at: string;
  recipients: TemplateMessageRecipientDto[];
}

export interface SendFileResponse {
  message?: MessageDto;
}

export interface SendFileViaUrlRequest {
  target: string;
  file_url: string;
  caption?: string;
}

export interface SendInteractiveMessageRequest {
  target: string;
  type: string;
  button_message?: ButtonsMessageDto;
  list_message?: ListMessageDto;
}

export interface SendInteractiveMessageResponse {
  message?: MessageDto;
}

export interface SendTemplateMessagesRequest {
  channel?: string;
  template_name: string;
  broadcast_name: string;
  recipients: TemplateMessageRecipientDto[];
}

export interface SendTemplateMessagesResponse {
  success?: boolean;
  broadcast_id?: string;
  error?: string;
  recipients?: TemplateMessageRecipientResultDto[];
}

export interface SendTextRequest {
  target: string;
  text: string;
}

export interface SendTextResponse {
  message?: ConversationEventDto;
}

export interface StagePipelineDto {
  stage?: string;
  count?: number;
}

export interface StartChatbotRequest {
  target: string;
  chatbot_id: string;
}

export interface StartChatbotResponse {
  result?: boolean;
}

export interface TemplateMessageRecipientDto {
  phone_number: string;
  local_message_id?: string;
  custom_params?: CustomParamDto[];
}

export interface TemplateMessageRecipientResultDto {
  local_message_id?: string;
  phone_number?: string;
  errors?: any[];
}

export interface TemplateParamDto {
  index?: number;
  param_name?: string;
}

export interface TemplateParameterDto {
  name?: string;
  value?: string;
}

export interface UnexpectedErrorResponse {
  code: string;
  message: string;
  timestamp?: string;
}

export interface UpdateContactRequest {
  target: string;
  customParams?: CustomParamDto[];
}

export interface UpdateContactsRequest {
  contacts: UpdateContactRequest[];
}

export interface UpdateContactsResponse {
  contact_list?: ContactDto[];
}

export interface UpdateConversationStatusRequest {
  new_status: string;
}

export interface UpdateConversationStatusResponse {
  result?: boolean;
}
