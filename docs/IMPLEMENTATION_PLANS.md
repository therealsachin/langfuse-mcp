# Langfuse MCP Server Implementation Plans

This document tracks the implementation status and future roadmap for the Langfuse MCP Server, helping prioritize development efforts and track progress toward complete API coverage.

## 📊 Current Status (v1.3.0)

**Total Implemented Tools: 28**
- ✅ Core Analytics Tools: 6
- ✅ Extended Analytics Tools: 6
- ✅ System & Management Tools: 6
- ✅ Dataset Management Tools: 7 ⭐ **COMPLETED in v1.2.0**
- ✅ Comment Management Tools: 3 ⭐ **COMPLETED in v1.3.0**

**API Coverage: ~50% of full Langfuse API**

## 🎯 Remaining Implementation Phases

### 🔴 **Phase 1: Core Collaboration (v1.3.0)** ⭐ **COMPLETED**
**Priority:** ⭐⭐⭐⭐⭐ **HIGHEST**
**Timeline:** 2-3 weeks
**Business Impact:** Critical for team workflows

#### **Comments System (3 tools)** ✅ **COMPLETED**
- ✅ `create_comment` - Add comments to traces/observations/sessions/prompts
  - **API:** `POST /api/public/comments`
  - **Params:** objectType, objectId, content, authorUserId, projectId
- ✅ `list_comments` - Get comments with filtering
  - **API:** `GET /api/public/comments`
  - **Filters:** objectType, objectId, authorUserId, pagination
- ✅ `get_comment` - Get individual comment details
  - **API:** `GET /api/public/comments/{commentId}`

#### **Session Management (2 tools)** ❌ **NOT AVAILABLE**
*Analysis revealed that Langfuse API does not include dedicated session endpoints*
- ❌ `list_sessions` - API endpoint does not exist
- ❌ `get_session` - API endpoint does not exist
- 📝 **Note:** Session data is handled through trace/observation entities

**Phase 1 Total: 3 new tools (25 → 28 total)**

---

### 🟡 **Phase 2: Advanced Workflows (v1.4.0)**
**Priority:** ⭐⭐⭐⭐ **HIGH**
**Timeline:** 3-4 weeks
**Business Impact:** Important for ML evaluation workflows

#### **Annotation Queues (9 tools)**
- [ ] `create_annotation_queue` - Create annotation workflows
  - **API:** `POST /api/public/annotation-queues`
- [ ] `list_annotation_queues` - Manage existing queues
  - **API:** `GET /api/public/annotation-queues`
- [ ] `get_annotation_queue` - Get queue details
  - **API:** `GET /api/public/annotation-queues/{queueId}`
- [ ] `create_queue_item` - Add items for annotation
  - **API:** `POST /api/public/annotation-queues/{queueId}/items`
- [ ] `list_queue_items` - Get items from queues
  - **API:** `GET /api/public/annotation-queues/{queueId}/items`
- [ ] `get_queue_item` - Get specific queue item
  - **API:** `GET /api/public/annotation-queues/{queueId}/items/{itemId}`
- [ ] `update_queue_item` - Update annotation status
  - **API:** `PATCH /api/public/annotation-queues/{queueId}/items/{itemId}`
- [ ] `delete_queue_item` - Remove items
  - **API:** `DELETE /api/public/annotation-queues/{queueId}/items/{itemId}`
- [ ] `manage_queue_assignments` - Assign queues to team members
  - **APIs:** `POST/DELETE /api/public/annotation-queues/{queueId}/assignments`

#### **Score Management (6 tools)**
- [ ] `create_score` - Add scores to traces/observations/sessions
  - **API:** `POST /api/public/scores`
- [ ] `list_scores` - Get scores with filtering
  - **API:** `GET /api/public/v2/scores`
- [ ] `get_score` - Get individual score
  - **API:** `GET /api/public/v2/scores/{scoreId}`
- [ ] `delete_score` - Remove scores
  - **API:** `DELETE /api/public/scores/{scoreId}`
- [ ] `create_score_config` - Define score structures
  - **API:** `POST /api/public/score-configs`
- [ ] `list_score_configs` - Manage score configurations
  - **API:** `GET /api/public/score-configs`

**Phase 2 Total: 15 new tools (30 → 45 total)**

---

### ⚡ **Phase 3: Complete CRUD (v1.5.0)**
**Priority:** ⭐⭐⭐ **MEDIUM**
**Timeline:** 2-3 weeks
**Business Impact:** Enhanced power-user features

#### **Model CRUD Enhancement (2 tools)**
*Current: Read-only operations*
- [ ] `create_model` - Register custom models
  - **API:** `POST /api/public/models`
- [ ] `delete_model` - Remove models
  - **API:** `DELETE /api/public/models/{id}`

#### **Prompt CRUD Enhancement (2 tools)**
*Current: Read-only operations*
- [ ] `create_prompt` - Create new prompt versions
  - **API:** `POST /api/public/v2/prompts`
- [ ] `update_prompt_label` - Manage prompt versioning/labels
  - **API:** `PATCH /api/public/v2/prompts/{name}/labels/{label}`

#### **LLM Provider Management (2 tools)**
- [ ] `list_llm_connections` - List configured providers
  - **API:** `GET /api/public/llm-connections`
- [ ] `upsert_llm_connection` - Configure LLM provider connections
  - **API:** `PUT /api/public/llm-connections`

#### **Advanced Operations (2 tools)**
- [ ] `delete_trace` - Remove traces
  - **API:** `DELETE /api/public/traces/{traceId}`
- [ ] `list_dataset_runs` - Get evaluation run history
  - **API:** `GET /api/public/datasets/{datasetName}/runs`

**Phase 3 Total: 8 new tools (45 → 53 total)**

---

### 🏢 **Phase 4: Enterprise Features (v2.0.0)**
**Priority:** ⭐⭐ **LOWER**
**Timeline:** 3-4 weeks
**Business Impact:** Enterprise and integration features

#### **Media & File Management (3 tools)**
- [ ] `create_media_upload_url` - Get presigned upload URLs
  - **API:** `POST /api/public/media`
- [ ] `get_media` - Retrieve media files
  - **API:** `GET /api/public/media/{mediaId}`
- [ ] `update_media` - Update media records
  - **API:** `PATCH /api/public/media/{mediaId}`

#### **Data Integration (3 tools)**
- [ ] `batch_ingest` - Bulk data ingestion
  - **API:** `POST /api/public/ingestion`
- [ ] `create_blob_storage_integration` - Configure blob storage
  - **API:** `PUT /api/public/integrations/blob-storage`
- [ ] `list_blob_storage_integrations` - Manage storage configs
  - **API:** `GET /api/public/integrations/blob-storage`

#### **Organization Management (6+ tools)**
*Requires organization-scoped API keys*
- [ ] `list_organization_projects` - Organization-level project listing
- [ ] `create_project` - Project CRUD operations
- [ ] `manage_api_keys` - API key lifecycle management
- [ ] `list_organization_users` - Team management (SCIM)
- [ ] `create_organization_user` - Add team members (SCIM)
- [ ] `delete_organization_user` - Remove team members (SCIM)

**Phase 4 Total: 12+ new tools (53 → 65+ total)**

---

## 📈 **Progress Tracking**

### **Completed Phases**
- [x] **v1.0.0** - Initial implementation (18 tools)
- [x] **v1.1.0** - Enhanced testing and documentation
- [x] **v1.2.0** - Dataset Management (7 new tools) ✅ **COMPLETED**
- [x] **v1.3.0** - Comment Management (3 new tools) ✅ **COMPLETED**

### **Upcoming Phases**
- [ ] **v1.4.0** - Advanced Workflows (15 new tools)
- [ ] **v1.5.0** - Complete CRUD (8 new tools)
- [ ] **v2.0.0** - Enterprise Features (12+ new tools)

### **Target Metrics**
- **Current API Coverage:** ~50% (28/55+ possible tools)
- **v1.4.0 Target:** ~80% (43/55+ tools)
- **v1.5.0 Target:** ~95% (51/55+ tools)
- **v2.0.0 Target:** ~98% (63+/65+ tools)

## 🎯 **Implementation Strategy**

### **Phase Selection Criteria**
1. **Business Impact** - Features that enable key ML workflows
2. **User Demand** - Most requested functionality
3. **Implementation Complexity** - Leverage existing patterns
4. **API Dependencies** - Some features require organization-scoped keys

### **Technical Considerations**
- **Consistent Patterns** - Follow established tool/client/test structure
- **Error Handling** - Maintain robust error management
- **Testing** - Comprehensive test coverage for each new tool
- **Documentation** - Update docs with each release

### **Next Recommended Phase**
**Phase 2 (Annotation Queues & Score Management)** because:
- ⭐ **High business value for ML evaluation workflows**
- 🔧 **Builds on existing dataset functionality**
- 👥 **Enables advanced team collaboration**
- 📊 **Critical for ML model evaluation and improvement**

## 📝 **Notes**

- This plan covers ~95% of the public Langfuse API surface
- Some enterprise features require organization-scoped API keys
- Implementation order can be adjusted based on user feedback
- Each phase includes comprehensive testing and documentation updates
- Focus on maintaining the high-quality patterns established in v1.2.0

---

**Last Updated:** November 9, 2024 (v1.3.0 completion)
**Next Target:** Phase 2 - Advanced Workflows (v1.4.0)