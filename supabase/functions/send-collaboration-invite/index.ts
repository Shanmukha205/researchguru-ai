import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, role, inviterEmail } = await req.json();

    if (!email || !role) {
      return new Response(JSON.stringify({ 
        error: 'Email and role are required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Resend API key
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    
    if (!RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not configured, skipping email');
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Invitation recorded (email service not configured)'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const siteUrl = Deno.env.get('SITE_URL') || 'https://lovable.dev';
    const inviteLink = `${siteUrl}/auth?invite=true&email=${encodeURIComponent(email)}`;

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Market Research Platform <noreply@resend.dev>',
        to: [email],
        subject: `You've been invited to collaborate on Market Research`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
              .header h1 { color: white; margin: 0; font-size: 24px; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
              .button { display: inline-block; background: #3b82f6; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0; }
              .button:hover { background: #2563eb; }
              .role-badge { display: inline-block; background: #e0e7ff; color: #3730a3; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 500; }
              .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎉 You're Invited!</h1>
              </div>
              <div class="content">
                <p>Hello,</p>
                <p><strong>${inviterEmail || 'A team member'}</strong> has invited you to collaborate on their Market Research workspace.</p>
                
                <p>Your assigned role: <span class="role-badge">${role.toUpperCase()}</span></p>
                
                <p>As a collaborator, you'll be able to:</p>
                <ul>
                  <li>View and analyze market research data</li>
                  <li>Access AI-powered insights and reports</li>
                  <li>Collaborate on research projects</li>
                </ul>
                
                <center>
                  <a href="${inviteLink}" class="button">Accept Invitation</a>
                </center>
                
                <p style="color: #6b7280; font-size: 14px;">
                  If you don't have an account yet, you'll be able to create one when you click the button above.
                </p>
              </div>
              <div class="footer">
                <p>Market Research Platform</p>
                <p style="font-size: 12px;">If you didn't expect this invitation, you can safely ignore this email.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error('Resend API error:', errorText);
      throw new Error('Failed to send email');
    }

    const result = await emailResponse.json();
    console.log('Email sent successfully:', result);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Invitation email sent successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error sending invitation:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Failed to send invitation'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});