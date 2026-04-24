import os
from datetime import datetime, timezone
from functools import wraps
from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "nexus-admin-secret-change-this")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


# ─── Auth Helpers ─────────────────────────────────────────────────────────────

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "admin_user_id" not in session:
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated

def super_admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "admin_user_id" not in session:
            return redirect(url_for("login"))
        if session.get("admin_role") != "super_admin":
            return jsonify({"error": "Super admin access required"}), 403
        return f(*args, **kwargs)
    return decorated

def get_admin_user():
    if "admin_user_id" not in session:
        return None
    res = supabase.table("users").select("*").eq("id", session["admin_user_id"]).single().execute()
    return res.data


# ─── Auth Routes ──────────────────────────────────────────────────────────────

@app.route("/")
def index():
    if "admin_user_id" in session:
        return redirect(url_for("dashboard"))
    return redirect(url_for("login"))


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        data = request.get_json() or request.form
        email = data.get("email", "").strip().lower()
        password = data.get("password", "")

        # Sign in via Supabase Auth using anon key temporarily
        from supabase import create_client
        anon_key = os.getenv("SUPABASE_ANON_KEY", SUPABASE_SERVICE_KEY)
        sb_auth = create_client(SUPABASE_URL, anon_key)

        try:
            auth_res = sb_auth.auth.sign_in_with_password({"email": email, "password": password})
            auth_user = auth_res.user
            if not auth_user:
                return jsonify({"error": "Invalid credentials"}), 401
        except Exception:
            return jsonify({"error": "Invalid email or password"}), 401

        # Check if user is in admins table
        admin = supabase.table("admins").select("*").eq("user_id", auth_user.id).single().execute()
        if not admin.data:
            return jsonify({"error": "You do not have admin access to Nexus Social"}), 403

        profile = supabase.table("users").select("*").eq("id", auth_user.id).single().execute()
        if not profile.data:
            return jsonify({"error": "User profile not found"}), 404

        session["admin_user_id"] = auth_user.id
        session["admin_role"] = admin.data["role"]
        session["admin_username"] = profile.data["username"]
        session["admin_nexus_id"] = profile.data["nexus_id"]
        session["admin_full_name"] = profile.data["full_name"]

        return jsonify({"success": True})

    return render_template("login.html")


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


# ─── Main Panel ───────────────────────────────────────────────────────────────

@app.route("/dashboard")
@admin_required
def dashboard():
    admin = get_admin_user()
    return render_template("panel.html", admin=admin, page="dashboard")


# ─── API: Stats ───────────────────────────────────────────────────────────────

@app.route("/api/stats")
@admin_required
def get_stats():
    users_res = supabase.table("users").select("id", count="exact").execute()
    total_users = users_res.count or 0

    banned = supabase.table("users").select("id", count="exact").eq("is_banned", True).execute()
    suspended = supabase.table("users").select("id", count="exact").eq("is_suspended", True).execute()

    reports = supabase.table("reports").select("id", count="exact").eq("status", "pending").execute()
    groups = supabase.table("groups").select("id", count="exact").execute()
    messages = supabase.table("direct_messages").select("id", count="exact").execute()

    # New users last 7 days
    from datetime import timedelta
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    new_week = supabase.table("users").select("id", count="exact").gte("created_at", week_ago).execute()

    # Daily signups for chart
    daily = []
    for i in range(6, -1, -1):
        day_start = (datetime.now(timezone.utc) - timedelta(days=i)).replace(hour=0, minute=0, second=0).isoformat()
        day_end = (datetime.now(timezone.utc) - timedelta(days=i)).replace(hour=23, minute=59, second=59).isoformat()
        count_res = supabase.table("users").select("id", count="exact").gte("created_at", day_start).lte("created_at", day_end).execute()
        daily.append(count_res.count or 0)

    return jsonify({
        "total_users": total_users,
        "banned_users": banned.count or 0,
        "suspended_users": suspended.count or 0,
        "pending_reports": reports.count or 0,
        "total_groups": groups.count or 0,
        "total_messages": messages.count or 0,
        "new_this_week": new_week.count or 0,
        "daily_signups": daily,
    })


# ─── API: Users ───────────────────────────────────────────────────────────────

@app.route("/api/users")
@admin_required
def get_users():
    q = request.args.get("q", "").strip()
    status_filter = request.args.get("status", "all")
    page = int(request.args.get("page", 1))
    per_page = 50
    offset = (page - 1) * per_page

    query = supabase.table("users").select("*").order("created_at").range(offset, offset + per_page - 1)

    if q:
        # Search by username or nexus_id or full_name
        query = supabase.table("users").select("*").or_(
            f"username.ilike.%{q}%,full_name.ilike.%{q}%,nexus_id.ilike.%{q}%,email.ilike.%{q}%"
        ).order("created_at").range(offset, offset + per_page - 1)

    if status_filter == "banned":
        query = supabase.table("users").select("*").eq("is_banned", True).order("created_at")
    elif status_filter == "suspended":
        query = supabase.table("users").select("*").eq("is_suspended", True).order("created_at")
    elif status_filter == "active":
        query = supabase.table("users").select("*").eq("is_banned", False).eq("is_suspended", False).order("created_at").range(offset, offset + per_page - 1)

    res = query.execute()
    return jsonify(res.data or [])


@app.route("/api/users/<user_id>")
@admin_required
def get_user_detail(user_id):
    user = supabase.table("users").select("*").eq("id", user_id).single().execute()
    if not user.data:
        return jsonify({"error": "User not found"}), 404

    # Get their groups
    groups = supabase.table("group_members").select(
        "role,groups(id,name,group_code,member_count)"
    ).eq("user_id", user_id).execute()

    # Get report count
    reports = supabase.table("reports").select("id", count="exact").eq("reported_user_id", user_id).execute()

    return jsonify({
        "user": user.data,
        "groups": groups.data or [],
        "report_count": reports.count or 0,
    })


@app.route("/api/users/<user_id>/suspend", methods=["POST"])
@admin_required
def suspend_user(user_id):
    data = request.get_json()
    days = int(data.get("days", 7))
    from datetime import timedelta
    until = (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()

    supabase.table("users").update({
        "is_suspended": True,
        "suspended_until": until,
    }).eq("id", user_id).execute()

    # Notify user
    supabase.table("notifications").insert({
        "user_id": user_id,
        "type": "system",
        "content": f"Your account has been suspended for {days} day(s) due to a violation of our Terms of Service.",
        "read": False,
    }).execute()

    return jsonify({"success": True, "suspended_until": until})


@app.route("/api/users/<user_id>/unsuspend", methods=["POST"])
@admin_required
def unsuspend_user(user_id):
    supabase.table("users").update({
        "is_suspended": False,
        "suspended_until": None,
    }).eq("id", user_id).execute()
    return jsonify({"success": True})


@app.route("/api/users/<user_id>/ban", methods=["POST"])
@admin_required
def ban_user(user_id):
    # Prevent banning super admin
    target = supabase.table("admins").select("role").eq("user_id", user_id).execute()
    if target.data and target.data[0]["role"] == "super_admin":
        return jsonify({"error": "Cannot ban the super admin"}), 403

    supabase.table("users").update({
        "is_banned": True,
        "is_suspended": False,
    }).eq("id", user_id).execute()

    return jsonify({"success": True})


@app.route("/api/users/<user_id>/unban", methods=["POST"])
@admin_required
def unban_user(user_id):
    supabase.table("users").update({"is_banned": False}).eq("id", user_id).execute()
    return jsonify({"success": True})


@app.route("/api/users/<user_id>/toggle-groups", methods=["POST"])
@admin_required
def toggle_user_groups(user_id):
    data = request.get_json()
    can = data.get("can_create_groups", True)
    supabase.table("users").update({"can_create_groups": can}).eq("id", user_id).execute()
    return jsonify({"success": True})


# ─── API: Reports ─────────────────────────────────────────────────────────────

@app.route("/api/reports")
@admin_required
def get_reports():
    status = request.args.get("status", "pending")
    res = supabase.table("reports").select(
        "*,reporter:users!reports_reporter_id_fkey(id,username,full_name,nexus_id),"
        "reported:users!reports_reported_user_id_fkey(id,username,full_name,nexus_id,is_banned)"
    ).eq("status", status).order("created_at", desc=True).execute()
    return jsonify(res.data or [])


@app.route("/api/reports/<report_id>/resolve", methods=["POST"])
@admin_required
def resolve_report(report_id):
    data = request.get_json()
    action = data.get("action")  # "resolve" | "dismiss"
    supabase.table("reports").update({"status": action}).eq("id", report_id).execute()
    return jsonify({"success": True})


# ─── API: Groups ──────────────────────────────────────────────────────────────

@app.route("/api/groups")
@admin_required
def get_groups():
    res = supabase.table("groups").select(
        "*,owner:users!groups_owner_id_fkey(id,username,full_name,nexus_id)"
    ).order("created_at", desc=True).execute()
    return jsonify(res.data or [])


@app.route("/api/groups/<group_id>/delete", methods=["DELETE"])
@admin_required
def delete_group(group_id):
    supabase.table("groups").delete().eq("id", group_id).execute()
    return jsonify({"success": True})


# ─── API: Settings ────────────────────────────────────────────────────────────

@app.route("/api/settings")
@admin_required
def get_settings():
    res = supabase.table("platform_settings").select("*").execute()
    settings = {row["key"]: row["value"] for row in (res.data or [])}
    return jsonify(settings)


@app.route("/api/settings/update", methods=["POST"])
@super_admin_required
def update_settings():
    data = request.get_json()
    for key, value in data.items():
        supabase.table("platform_settings").upsert({
            "key": key,
            "value": str(value),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).execute()

    # If groups just got enabled, notify all users
    if data.get("groups_enabled") == "true":
        users = supabase.table("users").select("id").eq("is_banned", False).eq("is_suspended", False).execute()
        if users.data:
            notifs = [{
                "user_id": u["id"],
                "type": "group",
                "content": "🎉 Group creation is now enabled! You can create your own group chats.",
                "read": False,
            } for u in users.data]
            # Insert in batches of 100
            for i in range(0, len(notifs), 100):
                supabase.table("notifications").insert(notifs[i:i+100]).execute()

    return jsonify({"success": True})


# ─── API: Officials ───────────────────────────────────────────────────────────

@app.route("/api/officials")
@admin_required
def get_officials():
    res = supabase.table("admins").select(
        "*,user:users(id,username,full_name,nexus_id,avatar_url,country)"
    ).order("created_at").execute()
    return jsonify(res.data or [])


@app.route("/api/officials/add", methods=["POST"])
@super_admin_required
def add_official():
    data = request.get_json()
    username = data.get("username", "").strip().lower()
    role = data.get("role", "moderator")

    user = supabase.table("users").select("id,username,full_name").eq("username", username).single().execute()
    if not user.data:
        return jsonify({"error": f"User @{username} not found"}), 404

    existing = supabase.table("admins").select("id").eq("user_id", user.data["id"]).execute()
    if existing.data:
        return jsonify({"error": "User is already an official"}), 400

    supabase.table("admins").insert({
        "user_id": user.data["id"],
        "role": role,
        "granted_by": session["admin_user_id"],
    }).execute()

    # Notify the new official
    supabase.table("notifications").insert({
        "user_id": user.data["id"],
        "type": "system",
        "content": f"You have been added as a Nexus Social {role.replace('_',' ').title()}. Visit the admin panel to get started.",
        "read": False,
    }).execute()

    return jsonify({"success": True})


@app.route("/api/officials/<official_id>/revoke", methods=["DELETE"])
@super_admin_required
def revoke_official(official_id):
    # Cannot revoke super admin
    official = supabase.table("admins").select("role,user_id").eq("id", official_id).single().execute()
    if official.data and official.data["role"] == "super_admin":
        return jsonify({"error": "Cannot revoke super admin"}), 403
    supabase.table("admins").delete().eq("id", official_id).execute()
    return jsonify({"success": True})


@app.route("/api/officials/<official_id>/update-role", methods=["POST"])
@super_admin_required
def update_official_role(official_id):
    data = request.get_json()
    role = data.get("role")
    supabase.table("admins").update({"role": role}).eq("id", official_id).execute()
    return jsonify({"success": True})


# ─── API: Broadcast ───────────────────────────────────────────────────────────

@app.route("/api/broadcast", methods=["POST"])
@super_admin_required
def broadcast():
    data = request.get_json()
    message = data.get("message", "").strip()
    if not message:
        return jsonify({"error": "Message cannot be empty"}), 400

    users = supabase.table("users").select("id").eq("is_banned", False).execute()
    if users.data:
        notifs = [{
            "user_id": u["id"],
            "type": "system",
            "content": f"📢 {message}",
            "read": False,
        } for u in users.data]
        for i in range(0, len(notifs), 100):
            supabase.table("notifications").insert(notifs[i:i+100]).execute()

    return jsonify({"success": True, "sent_to": len(users.data or [])})


# ─── API: Activity ────────────────────────────────────────────────────────────

@app.route("/api/activity")
@admin_required
def get_activity():
    # Recent signups
    signups = supabase.table("users").select(
        "id,username,full_name,nexus_id,created_at,country"
    ).order("created_at", desc=True).limit(5).execute()

    # Recent reports
    reports = supabase.table("reports").select(
        "id,type,created_at,reporter:users!reports_reporter_id_fkey(username),"
        "reported:users!reports_reported_user_id_fkey(username)"
    ).eq("status", "pending").order("created_at", desc=True).limit(5).execute()

    return jsonify({
        "recent_signups": signups.data or [],
        "recent_reports": reports.data or [],
    })


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=False)
