/**
 *A lil bit of jQuery is needed..
 * For active rows and the search. 
 */
$(document).ready(function(){
  $(document).on('click','#pwList li',function(){
    $('.row-active').removeClass('row-active');
    $(this).addClass('row-active')
  })
})


var app = angular.module('passman', ['ngResource', 'ngTagsInput', 'ngClipboard','offClick','ngClickSelect']).config(['$httpProvider',
function($httpProvider) {
  $httpProvider.defaults.headers.common.requesttoken = oc_requesttoken;
}]);
app.factory('shareService', ['$http',function($http){
  return{
    shareItem : function(item) {
      var queryUrl = OC.generateUrl('apps/passman/api/v1/sharing/share');
      return $http({
        url : queryUrl,
        method : 'PUT',
        data: item        
      })
    },
  }
}]);

app.factory('ItemService', ['$http',
function($http) {
  return {
    getItems : function(tags,showDeleted) {
      var queryUrl = (!showDeleted) ? OC.generateUrl('apps/passman/api/v1/getbytags?tags=' + tags.join(',')) : OC.generateUrl('apps/passman/api/v1/items/getdeleted?tags=' + tags.join(','));
      return $http({
        url : queryUrl,
        method : 'GET',
      })
    },
    update : function(item) {
      return $http({
        url : OC.generateUrl('apps/passman/api/v1/item/'+item.id),
        data: item,
        method : 'PATCH',
      })
    },
    softDestroy : function(item) {
     item.delete_date = Math.floor(new Date().getTime() / 1000);
     return $http({
        url : OC.generateUrl('apps/passman/api/v1/item/'+item.id),
        data: item,
        method : 'PATCH',
      })
    },
    recover : function(item) {
     item.delete_date = 0;
     return $http({
        url : OC.generateUrl('apps/passman/api/v1/item/'+item.id),
        data: item,
        method : 'PATCH',
      })
    },
    destroy : function(item) {
      return $http({
        url : OC.generateUrl('apps/passman/api/v1/item/delete/'+item.id),
        method : 'DELETE',
      })
    },
    create : function(item) {
      return $http({
        url : OC.generateUrl('apps/passman/api/v1/item'),
        data: item,
        method : 'PUT',
      })
    },
    removeCustomfield : function(id) {
      return $http({
        url : OC.generateUrl('apps/passman/api/v1/item/field/delete/'+id),
        method : 'DELETE',
      })
    },
    getFile: function(id){
      return $http({
        url : OC.generateUrl('/apps/passman/api/v1/item/file/' + id),
        method : 'GET',
      })
    },
    uploadFile: function(file){
      return $http({
        url : OC.generateUrl('apps/passman/api/v1/item/' + file.item_id + '/addfile'),
        method : 'PUT',
        data: file
      })
    },
    deleteFile: function(file){
      return $http({
        url : OC.generateUrl('apps/passman/api/v1/item/file/' + file.id),
        method : 'DELETE',
      })
    }
  }
}]);
app.factory('TagService', ['$http',
function($http) {
  return {
    getTag : function(tag) {
      return $http({
        url : OC.generateUrl('apps/passman/api/v1/tag/load?tag='+tag),
        method : 'GET',
      })
    },
    update : function(tag) {
      return $http({
        url : OC.generateUrl('apps/passman/api/v1/tag/update'),
        method : 'PATCH',
        data: tag
      })
    }
  }
}]);

app.controller('appCtrl', function($scope, ItemService, $http,$window,$timeout) {
  console.log('appCtrl');
  $scope.items = [];
  $scope.showingDeletedItems = false;
  $scope.tags = [];
  $scope.selectedTags = []
  $scope.noFavIcon = OC.imagePath('passman', 'lock.svg');
  $scope.sessionExpireTime = 0;
  var expireNotificationShown = false;
 
  
  $scope.loadItems = function(tags,showDeleted) {
    var idx = tags.indexOf('is:Deleted');
    if(idx >= 0){
       tags.splice(idx,1);
    }
    ItemService.getItems(tags,showDeleted).success(function(data) {
      $scope.tags = [];
      $scope.items = data.items;
      var tmp = []
      for (var i = 0; i < data.items.length; i++) {
        var tags = data.items[i].tags;
        if (tags) {
          for ( t = 0; t < tags.length; t++) {
            var tag = tags[t].text.trim();
            if (tmp.indexOf(tag) === -1) {
              tmp.push(tag);
            }
          }
        }
      }
      tmp.sort(function(x,y){ 
        var a = String(x).toUpperCase(); 
        var b = String(y).toUpperCase(); 
        if (a > b) 
           return 1 
        if (a < b) 
           return -1 
        return 0; 
      });
      $scope.tags = tmp;
    });
  };
  //$scope.loadItems([]);

  $scope.$watch("selectedTags", function(v) {
    if (!$scope.encryptionKey) {
      return;
    }

    var tmp = [];
    for (name in v) {
      tmp.push(v[name].text)
    }
    if(tmp.indexOf('is:Deleted')!==-1){
      $scope.showingDeletedItems = true;
    } else {
      $scope.showingDeletedItems = false;
    }
    $scope.loadItems(tmp,$scope.showingDeletedItems);
  }, true);

  $scope.selectTag = function(tag) {
    $scope.selectedTags.push({
      text : tag
    })
  };

  $window.decryptThis =  $scope.decryptThis = function(encryptedData,encKey) {
    var decryptedString = window.atob(encryptedData);
    var encKey = (encKey) ? encKey : $scope.getEncryptionKey();
    try {
      decryptedString = sjcl.decrypt(encKey, decryptedString);
    } catch(e) {
      console.log('Invalid key!');
      decryptedString = '';
    }

    return decryptedString;
  };

  $scope.encryptThis = $scope.encryptThis = function(str,encKey) {
    var encryptedString = str;
    var encKey = (encKey) ? encKey : $scope.getEncryptionKey();
    try {
      encryptedString = sjcl.encrypt(encKey, encryptedString)
    } catch(e) {
      console.log('Invalid key!',e);
      encryptedString = '';
    }
    encryptedString = window.btoa(encryptedString);
    return encryptedString;
  };
  $scope.getEncryptionKey = function(){
    return $scope.encryptionKey;
  }
  
  $scope.setEncryptionKey = function(key) {
    $scope.encryptionKey = key;
  };
  
  $scope.showSettings = function(){
    $( "#settingTabs" ).tabs().addClass( "ui-tabs-vertical ui-helper-clearfix" );
    $( "#settingTabs li" ).removeClass( "ui-corner-top" ).addClass( "ui-corner-left" );
    $('#settingsDialog').dialog({
      modal : true,
      width: '750px',
      height: 445,
      position:{ my: "center center", at: "center", of: window }
    });
  }
  $scope.showEncryptionKeyDialog = function() {
    $('#encryptionKeyDialog').dialog({
      draggable : false,
      resizable : false,
      closeOnEscape : false,
      modal : true,
      open : function(event, ui) {
        //$(".ui-dialog-titlebar-close").hide();
      },
      buttons : {
        "Ok" : function() {
          if ($('#ecKey').val() == '') {
            OC.Notification.showTimeout("Encryption key can't be empty!");
            return false;
          }
          $(this).dialog("close");
          $scope.setEncryptionKey($('#ecKey').val());
          $scope.loadItems([]);
          if ($('#ecRemember:checked').length > 0) {
            $.jStorage.set('encryptionKey', window.btoa($('#ecKey').val()));
            if ($('#rememberTime').val() != 'forever') {
             var time = $('#rememberTime').val() * 60 * 1000;
             $.jStorage.setTTL("encryptionKey", time);
             countLSTTL();
             }
          }
          $('#ecKey').val('');
          $('#ecRemember').removeAttr('checked');
          $('#rememberTime').val('15');
        }
      }
    });
  };
 
  
  var countLSTTL = function() {
    var time = $.jStorage.getTTL("encryptionKey");
    time = time / 1000;

    if (time === 0) {
      $scope.lockSession();
    }
    if(time < 300 && expireNotificationShown===false){
      OC.Notification.showTimeout('Your session expires in 5 minutes');
      expireNotificationShown = true;
    }

    seconds = Math.floor(time);
    var numyears = Math.floor(seconds / 31536000);
    var numdays = Math.floor((seconds % 31536000) / 86400);
    var numhours = Math.floor(((seconds % 31536000) % 86400) / 3600);
    var numminutes = Math.floor((((seconds % 31536000) % 86400) % 3600) / 60);
    var numseconds = (((seconds % 31536000) % 86400) % 3600) % 60;

    var str = "";
    if (numyears > 0) {
      str += numyears + " years ";
    }
    if (numdays > 0) {
      str += numdays + " days ";
    }
    if(numhours < 10){
      numhours = "0" + numhours;
    }
    if(numminutes < 10){
      numminutes = "0" + numminutes;
    }
    if(numseconds < 10){
      numseconds = "0" + numseconds;
    }
    str += numhours + ":";
    str += numminutes + ":";
    str += numseconds + "";
      
    $scope.sessionExpireTime = str;
    $timeout(countLSTTL, 1000);
  }; 

  $scope.loadTags = function(query) {
    return $http.get(OC.generateUrl('apps/passman/api/v1/tags/search?k=' + query));
  };
  
  /* 
   * Lock session
   */
  $scope.lockSession = function(){
    $scope.showEncryptionKeyDialog();
    $.jStorage.set('encryptionKey','');
    $scope.items = [];
  }
  /**
   *Onload -> Check if localstorage has key if not show dialog
   */
  if (!$.jStorage.get('encryptionKey')) {
    $scope.showEncryptionKeyDialog();
  } else {
    $scope.setEncryptionKey(window.atob( $.jStorage.get('encryptionKey')));
   //$scope.loadItems([]);
    countLSTTL();
  }

  $('#item_tabs').tabs();
});

app.controller('navigationCtrl', function($scope,TagService) {
  $scope.tagProps = {};
  
  $scope.tagSettings = function(tag,$event){
    $event.stopPropagation();
    TagService.getTag(tag).success(function(data){
      $scope.tagProps = data;
      $('#tagSettingsDialog').dialog({
        title: data.tag_label,
        width: 210,
        buttons:{
          "Save": function(){
            console.log($scope.tagProps)
            var t = this;
            TagService.update($scope.tagProps).success(function(data){
              $(t).dialog('close');
            })
          },
          "Close": function(){ $(this).dialog('close') }
        }
      });
    });
  }

});

app.controller('contentCtrl', function($scope, $sce,$compile,ItemService) {
  console.log('contentCtrl');
  $scope.currentItem = {};
  $scope.editing = false;
  $scope.showItem = function(rawItem) {
    var item = rawItem;
    var encryptedFields = ['account', 'email', 'password', 'description'];
    if (!item.decrypted) {
      for (var i = 0; i < encryptedFields.length; i++) {
        if(item[encryptedFields[i]]){
          item[encryptedFields[i]] = $scope.decryptThis(item[encryptedFields[i]]);
        }
      }
      for (var i = 0; i < item.customFields.length; i++) {
       item.customFields[i].label = $scope.decryptThis(item.customFields[i].label);
       item.customFields[i].value = $scope.decryptThis(item.customFields[i].value);
      }
      for (var i = 0; i < item.files.length; i++) {
        item.files[i].filename = $scope.decryptThis(item.files[i].filename);
        item.files[i].size = item.files[i].size;
        item.files[i].icon = (item.files[i].type.indexOf('image') !== -1) ? 'filetype-image' : 'filetype-file';
      }
    }

    item.decrypted = true;
    $scope.currentItem = item;
    $scope.currentItem.passwordConfirm = item.password;
    $scope.requiredPWStrength = 0;
  };
  
  $scope.recoverItem = function(item){
    ItemService.recover(item).success(function() {
        /*for (var i = 0; i < $scope.items.length; i++) {
          if ($scope.items[i].id == item.id) {
            var idx = $scope.items.indexOf(item);
            $scope.items.splice(idx, 1)
          }
        }*/
      });
      OC.Notification.showTimeout('<div>'+ item.label +' recoverd</div>');
  }

  $scope.shareItem = function(item){
    $scope.$broadcast('shareItem',item);
  }

  $scope.deleteItem = function(item, softDelete) {
    console.log(item, softDelete)
    if (softDelete) {
      ItemService.softDestroy(item).success(function() {
        for (var i = 0; i < $scope.items.length; i++) {
          if ($scope.items[i].id == item.id) {
            var idx = $scope.items.indexOf(item);
            $scope.items.splice(idx, 1)
          }
        }
      });
      OC.Notification.showTimeout('<div>'+ item.label +' deleted</div>');
    } else {
      ItemService.destroy(item).success(function() {
        for (var i = 0; i < $scope.items.length; i++) {
          if ($scope.items[i].id == item.id) {
            var idx = $scope.items.indexOf(item);
            $scope.items.splice(idx, 1)
          }
        }
      });
      OC.Notification.showTimeout('<div>'+ item.label +' destroyed</div>');
    }
  };

  /**
   *Download a file, still uses a lot of jQuery.... 
   */
  $scope.loadFile = function(file) {
    ItemService.getFile(file.id).success(function(data) {
      if (data.type.indexOf('image') >= 0 && data.size < 4194304) {
        var imageData = $scope.decryptThis(data.content);
        $('#fileImg').attr('src', imageData);
        $('#downloadImage').html('<a href="' + imageData + '" download="' + $scope.decryptThis(escapeHTML(data.filename)) + '">Save this image</a>');
        $('#fileImg').load(function() {
          $('#dialog_files').dialog({
            width : 'auto',
            title : $scope.decryptThis(data.filename),
            buttons : {
              "Close" : function() {
                $(this).dialog('destroy');
                $('#fileImg').attr('src', '');
                $('#downloadImage').html('');
              }
            }
          });
          var win = $(window);
          if ($('#fileImg').width() > win.width() || $('#fileImg').height() > win.height()) {
            $('#fileImg').css('width', $(window).width() * 0.8);
            $('#dialog_files').parent().position({
              my : "center",
              at : "center",
              of : window
            });
          }
        });
      } else {
        var fileData = $scope.decryptThis(data.content);
        //console.log(fileData);
        $('<div>Due popup blockers you have to click the below button to download your file.</div>').dialog({
          title : "Download " + escapeHTML($scope.decryptThis(data.filename)),
          content : 'test',
          buttons : {
            "Download" : function() {
              var uriContent = dataURItoBlob(fileData, data.type);
              /*var newWindow = window.open(uriContent, data.filename);*/
              var a = document.createElement("a");
              a.style = "display: none";
              a.href = uriContent;
              a.download = escapeHTML($scope.decryptThis(data.filename));
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              $(this).remove();
            },
            "Cancel" : function() {
              $(this).dialog('destroy').remove();
            }
          }
        });
      }
    })
  }


  $scope.copied = function(what) {
    OC.Notification.showTimeout('Copied ' + what.toLowerCase() + ' to clipboard');
  };
  $scope.addItem = function(){
   var newItem = {
      account: '',
      created: '',
      customFields: [],
      delete_date: "0",
      description: "",
      email: '',
      expire_time: 0,
      favicon: '',
      files: [],
      label: '',
      password: '',
      passwordConfirm: '',
      tags: [],
      url: ''
    };
    
    $scope.requiredPWStrength = 0;
    $scope.editItem(newItem);
    
  }
  $scope.editItem = function(item) {
    console.log(item)
    $scope.currentItem = item;
    $scope.editing = true;
    $sce.trustAsHtml($scope.currentItem.description);
    $('#editAddItemDialog').dialog({
      title : 'Edit item',
      "width" : ($(document).width() > 425) ? 'auto' : $(document).width() - 10,
    });
  };
});


app.controller('addEditItemCtrl', function($scope,ItemService) {
  console.log('addEditItemCtrl');
  $scope.pwFieldVisible = false;
  $scope.newCustomfield = {clicktoshow: 0};
  $scope.newExpireTime = 0;
  $scope.uploadQueue = {}
  $scope.generatedPW = '';
  $scope.pwInfo = {};
  $scope.currentPWInfo = {};
  $scope.pwSettings ={
    length: 12,
    upper: true,
    lower: true,
    digits: true,
    special: false,
    mindigits: 3,
    ambig: false,
    reqevery: true
  }
  /** The binding is fucked up...
  $scope.$watch('$parent.currentItem',function(n){
    $scope.currentItem = n;
  },true);
  $scope.$watch('currentItem',function(n){
    $scope.$parent.currentItem = n;
  },true);*/
  
  $scope.$watch('currentItem.password',function(newVal){
    if(typeof zxcvbn != 'function'){
      return;
    }
    if(!newVal){
      return;
    }
    $scope.currentPWInfo = zxcvbn(newVal);
    var today = new Date().getTime();
    var itemExpireDate = $scope.currentItem.expire_time*1;
    if(itemExpireDate < today && $scope.editing){
      var days = 86400000*$scope.renewal_period;
      $scope.newExpireTime = today*1+days; 
    }
  },true);
  
  $scope.$watch('currentItem.tags',function(newVal){
    if(!newVal){
      return;
    }
    $scope.requiredPWStrength = 0;
    $scope.renewal_period = 0;
    
    for(var i=0; i< newVal.length;i++){
      if(tag.min_pw_strength){
        if(tag.min_pw_strength >  $scope.requiredPWStrength){
          $scope.requiredPWStrength = tag.min_pw_strength;
        }
      }
      if(tag.renewal_period){
        if(tag.renewal_period >  $scope.renewal_period){
          $scope.renewal_period = tag.renewal_period*1;
        }
      }
    }
  },true);
  
  $scope.closeDialog = function(){
    $('#editAddItemDialog').dialog('close');
    $scope.generatedPW = '';
    $scope.currentPWInfo = {};
    $scope.editing = false;
    $scope.errors = [];
  }
  $scope.generatePW = function(){
    $scope.generatedPW = generatePassword($scope.pwSettings.length, $scope.pwSettings.upper, $scope.pwSettings.lower, $scope.pwSettings.digits, $scope.pwSettings.special, $scope.pwSettings.mindigits, $scope.pwSettings.ambig, $scope.pwSettings.reqevery);
    $scope.pwInfo = zxcvbn($scope.generatedPW );
  };
                                            //     allow spec char       //minimum digits  Avoid Ambiguous Characters     Require Every Character Type
  //generatePassword(length, upper, lower, digits, special,                 mindigits,      ambig,                       reqevery)
  $scope.togglePWField = function(){
    $scope.pwFieldVisible = ($scope.pwFieldVisible==false) ? true : false;
  };
  
  $scope.addCField = function(customField){
    if(!customField.label || !customField.value){
      return;
    }
    $scope.currentItem.customFields.push(customField);
    $scope.newCustomfield = {clicktoshow: 0};
  };
 
  $scope.removeCField = function(customField) {
    for (var i = 0; i < $scope.currentItem.customFields.length; i++) {
      if ($scope.currentItem.customFields[i].id == customField.id) {
        var idx = $scope.currentItem.customFields.indexOf(customField);
        $scope.currentItem.customFields.splice(idx, 1)
      }
    }
    if(customField.id){
      ItemService.removeCustomfield(customField.id);
    }
  }

  $scope.deleteFile = function(file) {
    ItemService.deleteFile(file).success(function() {
      for (var i = 0; i < $scope.currentItem.files.length; i++) {
        if ($scope.currentItem.files[i].id == file.id) {
          var idx = $scope.currentItem.files.indexOf(file);
          $scope.currentItem.files.splice(idx, 1)
        }
      }
    })
  }

  
  $scope.usePw = function(){
    $scope.currentItem.password =  $scope.generatedPW;
    $scope.currentItem.passwordConfirm = $scope.generatedPW;
  }
  
  $scope.saveItem = function(item){
    $scope.errors = [];
    var saveThis = angular.copy(item);
    var unEncryptedItem = angular.copy(saveThis);
    var encryptedFields = ['account', 'email', 'password', 'description'];
    for (var i = 0; i < encryptedFields.length; i++) {
      if(encryptedFields[i]=='description'){
        saveThis[encryptedFields[i]] = saveThis[encryptedFields[i]];
      }
      saveThis[encryptedFields[i]] = $scope.encryptThis(saveThis[encryptedFields[i]]);
    }
    if(saveThis.customFields.length > 0){
      for (var i = 0; i < saveThis.customFields.length; i++) {
        saveThis.customFields[i].label = $scope.encryptThis(saveThis.customFields[i].label);
        saveThis.customFields[i].value = $scope.encryptThis(saveThis.customFields[i].value);
        saveThis.customFields[i].clicktoshow = (saveThis.customFields[i].clicktoshow) ? 1 : 0; 
      }
    }
    
    /**
     *Field checking 
     */
    if(item.password != item.passwordConfirm){
      $scope.errors.push("Passwords do not match")
    }
    if($scope.requiredPWStrength > $scope.currentPWInfo.entropy){
      $scope.errors.push("Minimal password score not met")
    } 
    saveThis.expire_time = $scope.newExpireTime;
    if($scope.errors.length==0){
      delete saveThis.passwordConfirm;
      if(saveThis.id){
        ItemService.update(saveThis).success(function(data){
          if(data.success){
            $scope.errors = [];
            console.log(data)
            unEncryptedItem.expire_time = data.success.expire_time;
            $scope.$parent.currentItem = unEncryptedItem;
            $scope.closeDialog();
          }
        });
      } else {
        ItemService.create(saveThis).success(function(data){
            $scope.closeDialog();
            $scope.items.push(saveThis);
        });
      }
    }
  }
});

app.controller('settingsCtrl', function($scope,shareService) {
  $scope.settings = {
    PSC:{
      minStrength: 40,
      weakItemList: []
    }
  };
  
  $scope.checkPasswords = function(){
    $scope.settings.PSC.weakItemList = [];
    for(var i=0; i < $scope.items.length;i++){
      var tmp = angular.copy($scope.items[i]);
      var pwd = zxcvbn($scope.decryptThis(tmp.password));
      if(pwd.entropy < $scope.settings.PSC.minStrength){
         tmp.score = pwd.entropy; 
         tmp.password = pwd.password
         tmp.originalItem = $scope.items[i];
         if(tmp.password!=''){
          $scope.settings.PSC.weakItemList.push(tmp);
         }
      }
    }
  };
  
});

app.controller('shareCtrl', function($scope,$http,shareService) {
  $scope.shareSettings = {allowShareLink: false};
  $scope.loadUserAndGroups = function($query) {
    /* Enter the url where we get the search results for $query
     * As example i entered apps/passman/api/v1/sharing/search?k=
     */
    return $http.get(OC.generateUrl('apps/passman/api/v1/sharing/search?k=' + query));
  };
  
  $scope.createShareUrl = function(){
    if(!$scope.shareSettings.allowShareLink){
      $scope.shareSettings.allowShareLink = true;
    }
    if($scope.shareSettings.allowShareLink === true){
      /**
       *Share url generation here 
       */
      $scope.shareSettings.shareUrl = generatePassword(24);
    }
  };
  /**
   *Catch the shareItem event 
   */
  $scope.$on('shareItem', function(event, data) {
    shareItem(data);
  });

  /*
   * The function used for sharing
   */
  var shareItem = function(rawItem) {
    var item = angular.copy(rawItem);
    var encryptedFields = ['account', 'email', 'password', 'description'];
    if (!item.decrypted) {
      for (var i = 0; i < encryptedFields.length; i++) {
        if (item[encryptedFields[i]]) {
          item[encryptedFields[i]] = $scope.decryptThis(item[encryptedFields[i]]);
        }
      }
      for (var i = 0; i < item.customFields.length; i++) {
        item.customFields[i].label = $scope.decryptThis(item.customFields[i].label);
        item.customFields[i].value = $scope.decryptThis(item.customFields[i].value);
      }
      for (var i = 0; i < item.files.length; i++) {
        item.files[i].filename = $scope.decryptThis(item.files[i].filename);
        item.files[i].size = item.files[i].size;
        item.files[i].icon = (item.files[i].type.indexOf('image') !== -1) ? 'filetype-image' : 'filetype-file';
      }
    }
    /*
     * item now contain a unencrypted item (= password)
     */
    console.log('Share this item:', item);
    $scope.sharingItem = item;
    /**
     *Show the sharing dialog 
     */
    $('#shareDialog').dialog({
      title : 'Share ' + item.label,
      close : function(event, ui) {
        $scope.sharingItem = {allowShareLink: false};
         $scope.shareSettings = {};
      },
      buttons: {
        "Share": function(){
          $scope.createSharedItem();
        }    
      }
    });
    
    $scope.createSharedItem = function(){
      var item = angular.copy($scope.sharingItem);
      /** Do all special encryption etc here */
     
     
     /** And then share it */
     shareService.shareItem(item).success(function(data){
       /** Data contains the response from server */
      console.log(data)
     });
    };
  };
});




/***
 *Extend the OC Notification
 */
var notificationTimer;
OC.Notification.showTimeout = function(str, timeout) {
  OC.Notification.hide();
  if (notificationTimer) {
    clearTimeout(notificationTimer);
  }
  timeout = (!timeout) ? 3000 : timeout;
  OC.Notification.showHtml(str);
  notificationTimer = setTimeout(function() {
    OC.Notification.hide();
  }, timeout);
} 

function dataURItoBlob(dataURI, ftype) {
  // convert base64 to raw binary data held in a string
  // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
  var byteString = atob(dataURI.split(',')[1]);

  // separate out the mime component
  var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];

  // write the bytes of the string to an ArrayBuffer
  var ab = new ArrayBuffer(byteString.length);
  var ia = new Uint8Array(ab);
  for (var i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }

  // write the ArrayBuffer to a blob, and you're done
  var bb = new Blob([ab], {
    type : ftype
  });

  return URL.createObjectURL(bb);
}


/* Check if t function exists if not, create it to prevent errors */
if(null === t){
  function t(app,string){
    console.log('Fuck, l10n failed to load','App: '+ app,'String: '+ string);
    return string;
  }
}