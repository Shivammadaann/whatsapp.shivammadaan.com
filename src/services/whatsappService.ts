/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  WhatsAppTemplate,
  WhatsAppBusinessProfile,
  WhatsAppPhoneNumber,
  WhatsAppCommerceSettings,
  WhatsAppCatalogProduct,
  WhatsAppCallingProbe,
  WhatsAppCallPermissionAction,
  WhatsAppCallActionRequest,
  WhatsAppCallActionResponse,
  WhatsAppCallSessionDescription
} from '../types';
import { buildBackendUrl } from '../lib/backend';

  let ACCESS_TOKEN = '';
  let PHONE_NUMBER_ID = '';
  let BUSINESS_ACCOUNT_ID = '';
  let FACEBOOK_APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID || '';
  const API_VERSION = 'v25.0';
  const BASE_URL = buildBackendUrl('/api/wa');

  const getAuthHeaders = () => (
    ACCESS_TOKEN
      ? { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
      : {}
  );

  const getJsonHeaders = () => ({
    'Content-Type': 'application/json',
    ...getAuthHeaders()
  });

  const normalizeCallSession = (raw: any): WhatsAppCallSessionDescription | null => {
    const sdp =
      raw?.sdp ||
      raw?.session?.sdp ||
      raw?.session_description?.sdp ||
      raw?.sessionDescription?.sdp;
    const rawType =
      raw?.sdp_type ||
      raw?.sdpType ||
      raw?.type ||
      raw?.session?.sdp_type ||
      raw?.session?.sdpType ||
      raw?.session?.type ||
      raw?.session_description?.sdp_type ||
      raw?.session_description?.type ||
      raw?.sessionDescription?.sdpType ||
      raw?.sessionDescription?.type;
    const sdpType = String(rawType || '').toLowerCase();

    if (!sdp || !sdpType) return null;

    if (sdpType !== 'offer' && sdpType !== 'answer' && sdpType !== 'pranswer') {
      return null;
    }

    return {
      sdpType,
      sdp
    };
  };

  const normalizeCallPermissionActions = (rawActions: any[] = []): WhatsAppCallPermissionAction[] =>
    rawActions.map((action) => ({
      actionName: action?.action_name || action?.actionName,
      canPerformAction: Boolean(action?.can_perform_action ?? action?.canPerformAction),
      limits: Array.isArray(action?.limits)
        ? action.limits.map((limit: any) => ({
            timePeriod: limit?.time_period || limit?.timePeriod,
            maxAllowed: typeof limit?.max_allowed === 'number' ? limit.max_allowed : limit?.maxAllowed,
            currentUsage: typeof limit?.current_usage === 'number' ? limit.current_usage : limit?.currentUsage,
            limitExpirationTime: typeof limit?.limit_expiration_time === 'number' ? limit.limit_expiration_time : limit?.limitExpirationTime
          }))
        : []
    }));

  const cache: Record<string, { data: any, timestamp: number }> = {};
  const CACHE_TTL = 15000; // 15 seconds

  export const whatsappService = {
    setCredentials(accessToken: string, phoneNumberId: string, businessAccountId: string) {
      ACCESS_TOKEN = accessToken;
      PHONE_NUMBER_ID = phoneNumberId;
      BUSINESS_ACCOUNT_ID = businessAccountId;
      // Clear cache when credentials change
      Object.keys(cache).forEach(key => delete cache[key]);
    },

    clearCredentials() {
      ACCESS_TOKEN = '';
      PHONE_NUMBER_ID = '';
      BUSINESS_ACCOUNT_ID = '';
      Object.keys(cache).forEach(key => delete cache[key]);
    },

    getCredentials() {
      return {
        ACCESS_TOKEN,
        PHONE_NUMBER_ID,
        BUSINESS_ACCOUNT_ID,
        FACEBOOK_APP_ID
      };
    },

    async getUploadHandle(file: File, appId?: string): Promise<string | null> {
      const targetAppId = appId || FACEBOOK_APP_ID;
      if (!targetAppId) {
        console.error('Meta App ID not configured (VITE_FACEBOOK_APP_ID missing).');
        return null;
      }

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('app_id', targetAppId);

        const response = await fetch(`${BASE_URL}/upload-handle`, {
          method: 'POST',
          headers: {
            ...getAuthHeaders()
          },
          body: formData
        });

        const data = await response.json();
        if (!response.ok) {
          console.error('WhatsApp Upload Handle Error:', data);
          return null;
        }

        return data.handle || null;
      } catch (error) {
        console.error('WhatsApp Upload Handle Exception:', error);
        return null;
      }
    },

    async getTemplates(): Promise<WhatsAppTemplate[]> {
      if (!BUSINESS_ACCOUNT_ID) {
        console.warn('WhatsApp Service: BUSINESS_ACCOUNT_ID not set, skipping getTemplates');
        return [];
      }

      const cacheKey = `templates_${BUSINESS_ACCOUNT_ID}`;
      if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_TTL) {
        return cache[cacheKey].data;
      }

      try {
        const url = `${BASE_URL}/${BUSINESS_ACCOUNT_ID}/message_templates`;
        const response = await fetch(url, {
          headers: {
            ...getAuthHeaders()
          }
        });

        if (!response.ok) {
          const error = await response.json();
          console.error('WhatsApp Templates API Error:', error);
          return [];
        }

        const data = await response.json();
        const templates = data.data || [];
        cache[cacheKey] = { data: templates, timestamp: Date.now() };
        return templates;
      } catch (error) {
        console.error('WhatsApp Templates Exception:', error);
        return [];
      }
    },

  async sendTemplateMessage(to: string, templateName: string, languageCode: string = 'en_US', components: any[] = []) {
    if (!PHONE_NUMBER_ID) {
      console.error('WhatsApp Cloud API not configured (PHONE_NUMBER_ID missing).');
      return { success: false, error: 'API not configured' };
    }

    try {
      const url = `${BASE_URL}/${PHONE_NUMBER_ID}/messages`;
      const response = await fetch(url, {
        method: 'POST',
        headers: getJsonHeaders(),
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: templateName,
            language: {
              code: languageCode,
            },
            components,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('WhatsApp Send Message Error:', data);
        return { success: false, error: data.error?.message || 'Failed to send message' };
      }

      return { success: true, data };
    } catch (error) {
      console.error('WhatsApp Send Message Exception:', error);
      return { success: false, error: 'Connection failed' };
    }
  },

  async sendTextMessage(to: string, text: string) {
    if (!PHONE_NUMBER_ID) {
      console.error('WhatsApp Cloud API not configured (PHONE_NUMBER_ID missing).');
      return { success: false, error: 'API not configured' };
    }

    try {
      const url = `${BASE_URL}/${PHONE_NUMBER_ID}/messages`;
      const response = await fetch(url, {
        method: 'POST',
        headers: getJsonHeaders(),
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: {
            preview_url: false,
            body: text,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('WhatsApp Send Text Error:', data);
        return { success: false, error: data.error?.message || 'Failed to send text' };
      }

      return { success: true, data };
    } catch (error) {
      console.error('WhatsApp Send Text Exception:', error);
      return { success: false, error: 'Connection failed' };
    }
  },

  async sendMediaMessage(to: string, file: File) {
    if (!PHONE_NUMBER_ID) {
      console.error('WhatsApp Cloud API not configured (PHONE_NUMBER_ID missing).');
      return { success: false, error: 'API not configured' };
    }

    const mediaId = await this.uploadMedia(file, PHONE_NUMBER_ID);
    if (!mediaId) {
      return { success: false, error: 'Failed to upload media' };
    }

    const normalizedType = file.type.toLowerCase();
    const mediaType =
      normalizedType.startsWith('image/') ? 'image' :
      normalizedType.startsWith('video/') ? 'video' :
      normalizedType.startsWith('audio/') ? 'audio' :
      'document';

    try {
      const url = `${BASE_URL}/${PHONE_NUMBER_ID}/messages`;
      const response = await fetch(url, {
        method: 'POST',
        headers: getJsonHeaders(),
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: mediaType,
          [mediaType]: {
            id: mediaId,
            ...(mediaType === 'document' ? { filename: file.name } : {})
          }
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('WhatsApp Send Media Error:', data);
        return { success: false, error: data.error?.message || 'Failed to send media' };
      }

      return { success: true, data, mediaType, mediaId };
    } catch (error) {
      console.error('WhatsApp Send Media Exception:', error);
      return { success: false, error: 'Connection failed' };
    }
  },

  async getMediaMetadata(mediaId: string): Promise<any | null> {
    if (!mediaId) return null;

    try {
      const response = await fetch(`${BASE_URL}/${mediaId}`, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('WhatsApp Media Metadata Error:', data);
        return null;
      }

      return data;
    } catch (error) {
      console.error('WhatsApp Media Metadata Exception:', error);
      return null;
    }
  },

  async downloadMediaBlob(mediaId: string): Promise<Blob | null> {
    if (!mediaId) return null;

    try {
      const response = await fetch(buildBackendUrl(`/api/wa-media/${mediaId}/download`), {
        method: 'GET',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('WhatsApp Media Download Error:', errorText);
        return null;
      }

      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('json') || contentType.startsWith('text/html')) {
        const errorText = await response.text();
        console.error('WhatsApp Media Download Error:', errorText || `Unexpected media content type: ${contentType}`);
        return null;
      }

      return await response.blob();
    } catch (error) {
      console.error('WhatsApp Media Download Exception:', error);
      return null;
    }
  },

  async getBusinessProfile(phoneNumberId?: string): Promise<WhatsAppBusinessProfile | null> {
    const targetId = phoneNumberId || PHONE_NUMBER_ID;
    if (!targetId) {
      console.warn('WhatsApp Service: PHONE_NUMBER_ID not set, skipping getBusinessProfile');
      return null;
    }

    const cacheKey = `profile_${targetId}`;
    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_TTL) {
      return cache[cacheKey].data;
    }

    try {
      const url = `${BASE_URL}/${targetId}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical`;
      const response = await fetch(url, {
        headers: {
          ...getAuthHeaders()
        }
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('WhatsApp Business Profile Error:', error);
        return null;
      }

      const data = await response.json();
      const profile = data.data?.[0] || null;
      cache[cacheKey] = { data: profile, timestamp: Date.now() };
      return profile;
    } catch (error) {
      console.error('WhatsApp Business Profile Exception:', error);
      return null;
    }
  },

  async getPhoneNumbers(): Promise<WhatsAppPhoneNumber[]> {
    if (!BUSINESS_ACCOUNT_ID) {
      console.warn('WhatsApp Service: BUSINESS_ACCOUNT_ID not set, skipping getPhoneNumbers');
      return [];
    }

    const cacheKey = `phone_numbers_${BUSINESS_ACCOUNT_ID}`;
    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_TTL) {
      return cache[cacheKey].data;
    }

    try {
      const url = `${BASE_URL}/${BUSINESS_ACCOUNT_ID}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,status,name_status,messaging_limit_tier,whatsapp_business_manager_messaging_limit,search_visibility,code_verification_status,new_name_status,quality_score`;
      const response = await fetch(url, {
        headers: {
          ...getAuthHeaders()
        }
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('WhatsApp Phone Numbers Error:', error);
        return [];
      }

      const data = await response.json();
      const numbers = (data.data || []).map((phone: any) => ({
        phoneId: phone.id,
        displayPhoneNumber: phone.display_phone_number,
        verifiedName: phone.verified_name,
        qualityRating: typeof phone.quality_rating === 'object' ? (phone.quality_rating.score || 'UNKNOWN') : (phone.quality_rating || 'UNKNOWN'),
        status: phone.status,
        nameStatus: phone.name_status,
        messagingLimitTier: phone.messaging_limit_tier,
        whatsappBusinessManagerMessagingLimit: phone.whatsapp_business_manager_messaging_limit,
        searchVisibility: phone.search_visibility,
        codeVerificationStatus: phone.code_verification_status,
        newNameStatus: phone.new_name_status,
        qualityScore: typeof phone.quality_score === 'object' ? (phone.quality_score.score || 'UNKNOWN') : (phone.quality_score || 'UNKNOWN'),
        wabaId: BUSINESS_ACCOUNT_ID,
      }));
      cache[cacheKey] = { data: numbers, timestamp: Date.now() };
      return numbers;
    } catch (error) {
      console.error('WhatsApp Phone Numbers Exception:', error);
      return [];
    }
  },

  async getBusinessAccounts(): Promise<any[]> {
    if (!BUSINESS_ACCOUNT_ID) {
      console.warn('WhatsApp Service: BUSINESS_ACCOUNT_ID not set, skipping getBusinessAccounts');
      return [];
    }

    const cacheKey = `business_accounts_${BUSINESS_ACCOUNT_ID}`;
    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_TTL) {
      return cache[cacheKey].data;
    }

    try {
      const url = `${BASE_URL}/${BUSINESS_ACCOUNT_ID}?fields=id,name,currency,timezone_id,message_template_namespace,account_review_status,whatsapp_business_manager_messaging_limit`;
      const response = await fetch(url, {
        headers: {
          ...getAuthHeaders()
        }
      });
      const data = await response.json();
      const accounts = data && !data.error ? [{
        id: data.id,
        businessName: data.name,
        currency: data.currency,
        timezoneId: data.timezone_id,
        messageTemplateNamespace: data.message_template_namespace,
        accountReviewStatus: data.account_review_status,
        whatsappBusinessManagerMessagingLimit: data.whatsapp_business_manager_messaging_limit,
      }] : [];
      cache[cacheKey] = { data: accounts, timestamp: Date.now() };
      return accounts;
    } catch (error) {
      console.error('WhatsApp Business Accounts Error:', error);
      return [];
    }
  },

  async getCatalogs(): Promise<Array<{ id: string; name: string; vertical?: string }>> {
    if (!BUSINESS_ACCOUNT_ID) return [];

    try {
      const url = `${BASE_URL}/${BUSINESS_ACCOUNT_ID}/product_catalogs?fields=id,name,vertical`;
      const response = await fetch(url, {
        headers: {
          ...getAuthHeaders()
        }
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('WhatsApp Catalogs Error:', data);
        return [];
      }

      return (data.data || []).map((catalog: any) => ({
        id: String(catalog.id),
        name: catalog.name || `Catalog ${catalog.id}`,
        vertical: catalog.vertical
      }));
    } catch (error) {
      console.error('WhatsApp Catalogs Exception:', error);
      return [];
    }
  },

  async getCommerceSettings(phoneNumberId?: string): Promise<WhatsAppCommerceSettings | null> {
    const targetId = phoneNumberId || PHONE_NUMBER_ID;
    if (!targetId) return null;

    try {
      const url = `${BASE_URL}/${targetId}/whatsapp_commerce_settings?fields=id,catalog_id,is_catalog_visible,is_cart_enabled`;
      const response = await fetch(url, {
        headers: {
          ...getAuthHeaders()
        }
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('WhatsApp Commerce Settings Error:', data);
        return null;
      }

      const settings = Array.isArray(data.data) ? data.data[0] : null;
      if (!settings) {
        return {
          connected: false,
          catalogId: '',
          isCatalogVisible: false,
          isCartEnabled: false
        };
      }

      return {
        connected: Boolean(settings.catalog_id),
        catalogId: settings.catalog_id || '',
        isCatalogVisible: Boolean(settings.is_catalog_visible),
        isCartEnabled: Boolean(settings.is_cart_enabled)
      };
    } catch (error) {
      console.error('WhatsApp Commerce Settings Exception:', error);
      return null;
    }
  },

  async updateCommerceSettings(
    phoneNumberId: string,
    settings: {
      catalogId: string;
      isCatalogVisible?: boolean;
      isCartEnabled?: boolean;
    }
  ) {
    try {
      const url = `${BASE_URL}/${phoneNumberId}/whatsapp_commerce_settings`;
      const response = await fetch(url, {
        method: 'POST',
        headers: getJsonHeaders(),
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          catalog_id: settings.catalogId,
          is_catalog_visible: settings.isCatalogVisible ?? true,
          is_cart_enabled: settings.isCartEnabled ?? true
        })
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('WhatsApp Update Commerce Settings Error:', data);
        return { success: false, error: data.error?.message || 'Failed to update commerce settings' };
      }

      return { success: true, data };
    } catch (error) {
      console.error('WhatsApp Update Commerce Settings Exception:', error);
      return { success: false, error: 'Connection failed' };
    }
  },

  async getCatalogProducts(catalogId: string): Promise<WhatsAppCatalogProduct[]> {
    if (!catalogId) return [];

    try {
      const url = `${BASE_URL}/${catalogId}/products?fields=id,name,description,retailer_id,price,currency,image_url,availability`;
      const response = await fetch(url, {
        headers: {
          ...getAuthHeaders()
        }
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('WhatsApp Catalog Products Error:', data);
        return [];
      }

      return (data.data || []).map((product: any) => ({
        id: product.id,
        productRetailerId: product.retailer_id || product.product_retailer_id,
        name: product.name,
        description: product.description,
        currency: product.currency,
        price: product.price ? String(product.price) : '',
        imageUrl: product.image_url,
        availability: product.availability
      }));
    } catch (error) {
      console.error('WhatsApp Catalog Products Exception:', error);
      return [];
    }
  },

  async sendCatalogProductMessage(
    to: string,
    catalogId: string,
    productRetailerId: string,
    bodyText: string = 'Take a look at this product from our WhatsApp catalog.'
  ) {
    if (!PHONE_NUMBER_ID) {
      console.error('WhatsApp Cloud API not configured (PHONE_NUMBER_ID missing).');
      return { success: false, error: 'API not configured' };
    }

    try {
      const url = `${BASE_URL}/${PHONE_NUMBER_ID}/messages`;
      const response = await fetch(url, {
        method: 'POST',
        headers: getJsonHeaders(),
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'interactive',
          interactive: {
            type: 'product',
            body: {
              text: bodyText
            },
            action: {
              catalog_id: catalogId,
              product_retailer_id: productRetailerId
            }
          }
        })
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('WhatsApp Send Catalog Product Error:', data);
        return { success: false, error: data.error?.message || 'Failed to send catalog product' };
      }

      return { success: true, data };
    } catch (error) {
      console.error('WhatsApp Send Catalog Product Exception:', error);
      return { success: false, error: 'Connection failed' };
    }
  },

  async probeCallingApi(phoneNumberId?: string, userWaId: string = '919999999999'): Promise<WhatsAppCallingProbe> {
    const targetId = phoneNumberId || PHONE_NUMBER_ID;
    if (!targetId) {
      return {
        enabled: false,
        message: 'WhatsApp Cloud API is not configured for calls.'
      };
    }

    try {
      const url = `${BASE_URL}/${targetId}/call_permissions?user_wa_id=${encodeURIComponent(userWaId)}`;
      const response = await fetch(url, {
        headers: {
          ...getAuthHeaders()
        }
      });

      const data = await response.json();
      if (response.ok) {
        const permissionStatus = data.permission?.status || data.data?.[0]?.permission_status || data.permission_status;
        const permissionExpiresAt = data.permission?.expiration_time || data.permission?.expirationTime;
        const actions = normalizeCallPermissionActions(data.actions);
        const canStartCall = actions.some((action) => action.actionName === 'start_call' && action.canPerformAction);
        const canRequestPermission = actions.some((action) => action.actionName === 'send_call_permission_request' && action.canPerformAction);

        return {
          enabled: Boolean(canStartCall || ['temporary', 'permanent', 'granted', 'allowed'].includes(String(permissionStatus || '').toLowerCase())),
          permissionStatus,
          permissionExpiresAt,
          canStartCall,
          canRequestPermission,
          actions,
          raw: data
        };
      }

      return {
        enabled: false,
        permissionStatus: data.permission?.status || data.data?.[0]?.permission_status || data.error?.error_user_title,
        permissionExpiresAt: data.permission?.expiration_time || data.permission?.expirationTime,
        canStartCall: false,
        canRequestPermission: false,
        actions: normalizeCallPermissionActions(data.actions),
        message: data.error?.error_user_msg || data.error?.message || 'Calling API is unavailable for this phone number.',
        errorCode: data.error?.code,
        raw: data
      };
    } catch (error) {
      console.error('WhatsApp Call Permissions Exception:', error);
      return {
        enabled: false,
        message: 'Could not verify WhatsApp calling availability right now.'
      };
    }
  },

  async performCallAction(phoneNumberId: string, request: WhatsAppCallActionRequest): Promise<WhatsAppCallActionResponse> {
    if (!phoneNumberId) {
      return {
        success: false,
        message: 'No WhatsApp phone number is connected for calls.'
      };
    }

    try {
      const url = `${BASE_URL}/${phoneNumberId}/calls`;
      const payload: Record<string, any> = {
        messaging_product: 'whatsapp',
        action: request.action
      };

      if (request.to) {
        payload.to = request.to;
      }

      if (request.callId) {
        payload.call_id = request.callId;
      }

      if (request.session) {
        payload.session = {
          sdp_type: request.session.sdpType,
          sdp: request.session.sdp
        };
      }

      if (request.bizOpaqueCallbackData) {
        payload.biz_opaque_callback_data = request.bizOpaqueCallbackData;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: getJsonHeaders(),
        body: JSON.stringify(payload)
      });

      const responseText = await response.text();
      let data: any = {};
      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch {
          data = { rawText: responseText };
        }
      }
      if (!response.ok) {
        return {
          success: false,
          message: data.error?.error_user_msg || data.error?.message || 'Failed to perform WhatsApp call action.',
          raw: data
        };
      }

      return {
        success: true,
        callId: data.calls?.[0]?.id || data.call_id || data.callId || request.callId,
        session: normalizeCallSession(data.session || data.calls?.[0]?.session),
        raw: data
      };
    } catch (error) {
      console.error('WhatsApp Call Action Exception:', error);
      return {
        success: false,
        message: 'Could not complete the WhatsApp call action right now.'
      };
    }
  },

  async getPhoneNumberDetail(phoneNumberId: string): Promise<WhatsAppPhoneNumber | null> {
    try {
      const url = `${BASE_URL}/${phoneNumberId}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`
        }
      });
      const data = await response.json();
      return data || null;
    } catch (error) {
      console.error('WhatsApp Phone Number Detail Error:', error);
      return null;
    }
  },

  async updatePhoneNumberVerifiedName(phoneNumberId: string, verifiedName: string): Promise<boolean> {
    try {
      const url = `${BASE_URL}/${phoneNumberId}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: getJsonHeaders(),
        body: JSON.stringify({
          verified_name: verifiedName
        })
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('WhatsApp Update Verified Name Error:', data);
        return false;
      }
      return true;
    } catch (error) {
      console.error('WhatsApp Update Verified Name Exception:', error);
      return false;
    }
  },

  async getBusinessProfileAbout(phoneNumberId: string): Promise<any> {
    const profile = await this.getBusinessProfile(phoneNumberId);
    return { text: profile?.about || 'Available' };
  },

  async uploadMedia(file: File, phoneNumberId?: string): Promise<string | null> {
    const targetId = phoneNumberId || PHONE_NUMBER_ID;
    if (!targetId) return null;

    try {
      const url = `${BASE_URL}/${targetId}/media`;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('messaging_product', 'whatsapp');
      formData.append('type', file.type); // Add type as it's often required

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...getAuthHeaders()
        },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('WhatsApp Media Upload Error:', data);
        return null;
      }

      return data.id || null;
    } catch (error) {
      console.error('WhatsApp Media Upload Exception:', error);
      return null;
    }
  },

  async updateBusinessProfile(phoneNumberId: string, profileData: any): Promise<boolean> {
    try {
      const url = `${BASE_URL}/${phoneNumberId}/whatsapp_business_profile`;
      
      // Ensure messaging_product is included
      const payload = {
        messaging_product: 'whatsapp',
        ...profileData
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: getJsonHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('WhatsApp Update Business Profile Error:', data);
        return false;
      }
      return true;
    } catch (error) {
      console.error('WhatsApp Update Business Profile Error:', error);
      return false;
    }
  },

  async updateBusinessProfileAbout(phoneNumberId: string, about: string): Promise<boolean> {
    // In Cloud API, 'about' is updated via the profile endpoint
    return this.updateBusinessProfile(phoneNumberId, { about });
  },

  async updateBusinessProfilePhoto(phoneNumberId: string, file: File): Promise<boolean> {
    try {
      const uploadHandle = await this.getUploadHandle(file);
      if (!uploadHandle) return false;

      return this.updateBusinessProfile(phoneNumberId, {
        profile_picture_handle: uploadHandle
      });
    } catch (error) {
      console.error('WhatsApp Update Profile Photo Error:', error);
      return false;
    }
  },

  async createTemplate(name: string, category: string, language: string, components: any[]): Promise<any> {
    if (!BUSINESS_ACCOUNT_ID) {
      console.error('WhatsApp Cloud API not configured (BUSINESS_ACCOUNT_ID missing).');
      return { success: false, error: 'API not configured' };
    }

    try {
      const url = `${BASE_URL}/${BUSINESS_ACCOUNT_ID}/message_templates`;
      const response = await fetch(url, {
        method: 'POST',
        headers: getJsonHeaders(),
        body: JSON.stringify({
          name,
          category,
          language,
          components,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('WhatsApp Create Template Error:', data);
        return { success: false, error: data.error?.message || 'Failed to create template' };
      }

      return { success: true, data };
    } catch (error) {
      console.error('WhatsApp Create Template Exception:', error);
      return { success: false, error: 'Connection failed' };
    }
  }
};
