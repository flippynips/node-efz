import * as express from 'express';
import { MenuItem } from './MenuItem';
import { PermissionsByUser } from '../Data/Accounts/Index';

export const PasswordRegex = /[A-Za-z0-9@$!%*?&# ()+=_\/\\-]{6,30}/;

class MenuController {
  
  protected _menuItems: MenuItem[];
  
  constructor() {
    this._menuItems = [];
  }
  
  public Add(menuItem: MenuItem): void {
    this._menuItems.push(menuItem);
  }
  
  /** Get an appropriate menu for the specified request and user */
  public async Get(req: express.Request, res: express.Response): Promise<MenuItem[]> {
  
    let menu: MenuItem[] = [];
    
    for(let menuItem of this._menuItems) {
      if(req.path === menuItem.Path) continue;
      if(menuItem.Access) {
        if(!res.locals.User) continue;
        let permit: boolean = true;
        for(let access of menuItem.Access) {
          if(!await PermissionsByUser.HasAccess(res.locals.User.Id, access.Access, access.Resource)) {
            permit = false;
            break;
          }
        }
        if(!permit) continue;
      }
      if(menuItem.Predicate && !menuItem.Predicate(req, res)) {
        continue;
      }
      menu.push(menuItem);
    }
    
    // reorder the menu items
    menu.sort((a, b) => a.Priority > b.Priority || a.Priority == null ? 1 : -1);
    
    return menu;
    
  }
  
}

/** Menu access. */
export const Menu = new MenuController();
